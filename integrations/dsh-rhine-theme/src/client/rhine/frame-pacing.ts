/** Keep at most two GPU submissions in flight without blocking the renderer thread.
 * Animation follows presentation callbacks, not a 60 Hz timer. When the GPU is
 * busy we submit the newest state next time instead of building an input-lag queue.
 */
export class FramePacing {
  private pending: WebGLSync[] = []
  constructor(private gl: WebGL2RenderingContext) {}
  canSubmit() {
    while (this.pending.length) {
      const status = this.gl.clientWaitSync(this.pending[0], 0, 0)
      if (status === this.gl.TIMEOUT_EXPIRED) break
      this.gl.deleteSync(this.pending.shift()!)
    }
    return this.pending.length < 2
  }
  submitted() {
    const fence = this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    if (fence) this.pending.push(fence)
  }
  dispose() { for (const fence of this.pending) this.gl.deleteSync(fence); this.pending.length = 0 }
}
