export type HSV={h:number;s:number;v:number};
export function rgbToHsv(r:number,g:number,b:number):HSV{r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);return{h:(h+360)%360,s:max?d/max:0,v:max}}
export type ColorFamily='red'|'yellow'|'green'|'blue'|'purple'|'neutral';
export function colorFamily({h,s,v}:HSV):ColorFamily{if(s<.2||v<.15)return'neutral';if(h<30||h>=340)return'red';if(h<75)return'yellow';if(h<165)return'green';if(h<255)return'blue';return'purple'}
export class StableColor{private candidate:ColorFamily='neutral';private count=0;value:ColorFamily='neutral';update(next:ColorFamily){if(next===this.candidate)this.count++;else{this.candidate=next;this.count=1}if(this.count>=8)this.value=next;return this.value}}
