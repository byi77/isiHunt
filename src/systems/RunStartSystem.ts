/** Locks synchronously, before a start can reach its first asynchronous call. */
export class RunStartSystem {
  private locked = false;
  get busy(): boolean {
    return this.locked;
  }
  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }
  release(): void {
    this.locked = false;
  }
}
