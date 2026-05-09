// Soft-fail violation log for the Tracer Bullet.
// Per Tracer plan §6.1 and §6.4: accumulate violations across the run; print at end; never throw.

export class ViolationLog {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  recordError(stage, message, context = {}) {
    this.errors.push({ stage, message, context, severity: 'error', timestamp: Date.now() });
  }

  recordWarning(stage, message, context = {}) {
    this.warnings.push({ stage, message, context, severity: 'warning', timestamp: Date.now() });
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  printReport() {
    console.log('\nViolation Report:');
    console.log(`  Errors:   ${this.errors.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach((v, i) => {
        console.log(`  [${i + 1}] ${v.stage}: ${v.message}`);
        if (Object.keys(v.context).length > 0) {
          const ctx = JSON.stringify(v.context, null, 2).split('\n').join('\n      ');
          console.log(`      context: ${ctx}`);
        }
      });
    }
    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      this.warnings.forEach((v, i) => {
        console.log(`  [${i + 1}] ${v.stage}: ${v.message}`);
      });
    }
  }
}
