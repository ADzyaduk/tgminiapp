-- Create the group_trips table
CREATE TABLE public.group_trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  departure_time TIMESTAMPTZ NOT NULL,
  return_time TIMESTAMPTZ NOT NULL,
  max_capacity INT NOT NULL CHECK (max_capacity > 0 AND max_capacity <= 11),
  available_seats INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'open', 'full', 'in_progress', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT available_seats_check CHECK (available_seats >= 0 AND available_seats <= max_capacity)
);

-- Create RLS policies for group_trips
ALTER TABLE public.group_trips ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see all trips
CREATE POLICY "Admins can see all group trips" ON public.group_trips
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Policy for managers to see and manage their created trips
CREATE POLICY "Managers can see and manage their created trips" ON public.group_trips
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'manager')
    AND (
      created_by = auth.uid()
      OR
      auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
    )
  );

-- Policy for all authenticated users to view open trips
CREATE POLICY "Users can view available trips" ON public.group_trips
  FOR SELECT USING (
    status IN ('open', 'planned')
    AND departure_time > NOW()
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at timestamps
CREATE TRIGGER update_group_trips_updated_at
BEFORE UPDATE ON public.group_trips
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create the group_trip_bookings table
CREATE TABLE public.group_trip_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.group_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adult_tickets INT NOT NULL CHECK (adult_tickets >= 0),
  child_tickets INT NOT NULL CHECK (child_tickets >= 0),
  total_price INT NOT NULL CHECK (total_price >= 0),
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT at_least_one_ticket CHECK (adult_tickets > 0 OR child_tickets > 0)
);

-- Create RLS policies for group_trip_bookings
ALTER TABLE public.group_trip_bookings ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own bookings
CREATE POLICY "Users can see their own bookings" ON public.group_trip_bookings
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Policy for admins to see all bookings
CREATE POLICY "Admins can see all bookings" ON public.group_trip_bookings
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Policy for managers to see bookings for their trips
CREATE POLICY "Managers can see bookings for their trips" ON public.group_trip_bookings
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM public.group_trips 
      WHERE created_by = auth.uid()
    )
  );

-- Create trigger for updated_at timestamps
CREATE TRIGGER update_group_trip_bookings_updated_at
BEFORE UPDATE ON public.group_trip_bookings
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create stored procedure for creating bookings with transaction handling
CREATE OR REPLACE FUNCTION create_group_booking(booking_data jsonb, tickets_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trip_record record;
  new_booking_id uuid;
BEGIN
  -- Check if trip exists and has enough seats
  SELECT * INTO trip_record 
  FROM group_trips 
  WHERE id = (booking_data->>'trip_id')::uuid 
    AND status = 'open' 
    AND available_seats >= tickets_count;
  
  IF trip_record.id IS NULL THEN
    RAISE EXCEPTION 'Not enough available seats or trip is closed for booking';
  END IF;
  
  -- Create booking
  INSERT INTO group_trip_bookings (
    trip_id,
    user_id,
    adult_tickets,
    child_tickets,
    total_price,
    booking_status
  ) VALUES (
    (booking_data->>'trip_id')::uuid,
    (booking_data->>'user_id')::uuid,
    (booking_data->>'adult_tickets')::integer,
    (booking_data->>'child_tickets')::integer,
    (booking_data->>'total_price')::integer,
    'confirmed'
  )
  RETURNING id INTO new_booking_id;
  
  -- Update available seats count
  UPDATE group_trips
  SET available_seats = available_seats - tickets_count,
      status = CASE 
                WHEN available_seats - tickets_count <= 0 THEN 'full'
                ELSE status
              END
  WHERE id = (booking_data->>'trip_id')::uuid;
  
  RETURN jsonb_build_object('booking_id', new_booking_id);
END;
$$;

-- Create or replace function to cancel a booking
CREATE OR REPLACE FUNCTION cancel_group_booking(booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record record;
  trip_record record;
  total_tickets integer;
BEGIN
  -- Get booking details
  SELECT * INTO booking_record 
  FROM group_trip_bookings 
  WHERE id = booking_id AND booking_status = 'confirmed';
  
  IF booking_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calculate total tickets
  total_tickets := booking_record.adult_tickets + booking_record.child_tickets;
  
  -- Get trip details
  SELECT * INTO trip_record 
  FROM group_trips 
  WHERE id = booking_record.trip_id;
  
  -- Update booking status
  UPDATE group_trip_bookings
  SET booking_status = 'cancelled'
  WHERE id = booking_id;
  
  -- Return seats to available pool
  UPDATE group_trips
  SET available_seats = available_seats + total_tickets,
      status = CASE 
                WHEN status = 'full' AND available_seats + total_tickets > 0 THEN 'open'
                ELSE status
              END
  WHERE id = booking_record.trip_id;
  
  RETURN true;
END;
$$; 