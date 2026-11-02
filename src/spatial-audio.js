import { listeningPosition } from './spatial-position.js';

export function createSpatialPanner(context) {
  const panner = context.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1.6;
  panner.rolloffFactor = .38;
  panner.channelCount = 1;
  panner.channelCountMode = 'explicit';
  return panner;
}

// The same HTML audio element owns seeking, loading, and Safari playback.
// Web Audio only places its output; both resume() and play() run in the tap.
export function spatialAudio(audio, getPosition, Context = window.AudioContext || window.webkitAudioContext) {
  let context, panner;
  function move() {
    if (!panner) return;
    const p = listeningPosition(getPosition());
    if (panner.positionX) {
      for (const axis of ['x', 'y', 'z']) {
        const param = panner[`position${axis.toUpperCase()}`];
        param.setTargetAtTime(p[axis], context.currentTime, .04);
      }
    } else panner.setPosition(p.x, p.y, p.z);
  }
  function unlock() {
    if (!Context) return Promise.resolve(false);
    if (!context) {
      context = new Context();
      panner = createSpatialPanner(context);
      panner.connect(context.destination);
      const source = context.createMediaElementSource(audio);
      source.connect(panner);
      move();
    }
    return (context.state === 'running' ? Promise.resolve() : context.resume()).then(() => true);
  }
  return { unlock, move };
}
