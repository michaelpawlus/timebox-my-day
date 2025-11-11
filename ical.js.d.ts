declare module 'ical.js' {
  export interface Time {
    toJSDate(): Date
    isDate: boolean
  }

  export class Component {
    constructor(jcalData: any)
    getAllSubcomponents(name: string): any[]
  }

  export class Event {
    constructor(component: any)
    summary: string
    location: string
    startDate: Time
    endDate: Time
    isRecurring(): boolean
  }

  export function parse(input: string): any

  const ICAL: {
    parse: typeof parse
    Component: typeof Component
    Event: typeof Event
  }

  export default ICAL
}
