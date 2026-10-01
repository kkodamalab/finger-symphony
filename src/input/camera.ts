import type { Point } from '../performance/frame';
export const displayPointForCamera=(point:Point,mirrored:boolean):Point=>({x:mirrored?1-point.x:point.x,y:point.y});
export function setCameraPresentation(video:HTMLVideoElement,visible:boolean,mirrored:boolean){video.hidden=!visible;video.classList.toggle('mirrored',mirrored)}
