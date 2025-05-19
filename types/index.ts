export type Boat = {
    id: string
    name: string
    price: number
    agent_price: number
    images?: string[]
    tags?: string[]
    specs: {
      capacity: number
      length: number
      engine: string
      year: number
    }
  }