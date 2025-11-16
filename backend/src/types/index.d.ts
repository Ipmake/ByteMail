declare module 'imap-simple' {
  export function connect(config: any): Promise<any>;
  export default { connect };
}

declare module 'mailparser' {
  export function simpleParser(source: any, options?: any): Promise<any>;
}
