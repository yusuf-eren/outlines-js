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

function isJSON(value: any): value is JSON {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
