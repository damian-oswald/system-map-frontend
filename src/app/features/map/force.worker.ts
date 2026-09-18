/// <reference lib="webworker" />
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, SimulationNodeDatum } from 'd3-force';

import { ForceRequest, ForceResponse } from './force-layout';

interface N extends SimulationNodeDatum {
	id: string;
	col: number;
	r: number;
}

// The simulation runs to convergence here, off the main thread; the page only ever renders the final, static result.
addEventListener('message', ({ data }: MessageEvent<ForceRequest>) => {
	const nodes: N[] = data.nodes.map((n, i) => ({
		id: n.id,
		col: n.col,
		r: n.r,
		// seed with previous positions (stable re-layouts) or a phyllotaxis spiral (deterministic)
		x: n.x ?? Math.sqrt(i + 0.5) * 18 * Math.cos(i * 2.39996),
		y: n.y ?? Math.sqrt(i + 0.5) * 18 * Math.sin(i * 2.39996),
	}));
	const seeded = data.nodes.some((n) => n.x !== undefined);
	const spread = Math.max(400, Math.sqrt(nodes.length) * 60);
	const sim = forceSimulation(nodes)
		.force(
			'link',
			forceLink<N, { source: string; target: string; hier: boolean }>(data.links)
				.id((d) => d.id)
				// children sit close to their parent
				.distance((l) => (l.hier ? 30 : 58))
				.strength((l) => (l.hier ? 0.9 : 0.5)),
		)
		.force('charge', forceManyBody<N>().strength(-150).theta(0.9).distanceMax(600))
		.force('collide', forceCollide<N>((d) => d.r + 8).iterations(2))
		// labels run left to right, so the class ordering (org → system → service → data) is a gentle top-down bias
		.force('x', forceX<N>(0).strength(0.05))
		.force('y', forceY<N>((d) => (d.col - 1.5) * spread * 0.28).strength(0.07))
		.stop();
	if (seeded) sim.alpha(0.5);
	const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
	sim.tick(ticks);
	const positions: ForceResponse['positions'] = {};
	for (const n of nodes) positions[n.id] = [Math.round(n.x! * 10) / 10, Math.round(n.y! * 10) / 10];
	postMessage({ requestId: data.requestId, positions } satisfies ForceResponse);
});
