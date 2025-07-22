function isInt(value: any): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFloat(value: any): value is number {
  return typeof value === 'number' && !Number.isInteger(value);
}

function isStr(value: any): value is string {
  return typeof value === 'string';
}

function isBool(value: any): value is boolean {
  return typeof value === 'boolean';
}

function isDate(value: any): value is Date {
  return value instanceof Date;
}
