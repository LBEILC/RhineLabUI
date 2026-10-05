import cassette from '../../../assets/archive-cassette.glb'
import assembly from '../../../assets/optical-archive.glb'
/** Bundled resources work inside Electron's dsh-app protocol without network. */
export function assetUrl(file: string) { return file.includes('assembly') ? assembly : cassette }
