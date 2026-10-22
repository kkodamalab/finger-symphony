/** Tail-to-head blend followed by trimming the redundant head. Boundary advances by one source sample. */
export function seamlessLoop(input:Float32Array,samples:number){
 const n=Math.max(1,Math.min(Math.floor(samples),Math.floor(input.length/3)));
 const output=input.slice(n);
 for(let i=0;i<n;i++){const t=(i+1)/n;output[output.length-n+i]=input[input.length-n+i]*(1-t)+input[i]*t}
 return output;
}
