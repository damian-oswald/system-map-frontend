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
	// deterministic pseudo-random seed per node: the same graph always lands in the same picture, but the picture
	// does not start from (and settle into) a disc
	const scatter = (id: string, salt: number): number => {
		let h = salt;
		for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
		return ((h >>> 0) % 10000) / 10000 - 0.5;
	};
	const span = Math.max(600, Math.sqrt(data.nodes.length) * 70);
	const nodes: N[] = data.nodes.map((n) => ({
		id: n.id,
		col: n.col,
		r: n.r,
		// seed with previous positions (stable re-layouts) or a scattered, wider-than-tall cloud
		x: n.x ?? scatter(n.id, 1) * span * 1.6,
		y: n.y ?? scatter(n.id, 2) * span,
	}));
	const seeded = data.nodes.some((n) => n.x !== undefined);
	const sim = forceSimulation(nodes)
		.force(
			'link',
			forceLink<N, { source: string; target: string; hier: boolean }>(data.links)
				.id((d) => d.id)
				// children sit close to their parent
				.distance((l) => (l.hier ? 30 : 58))
				.strength((l) => (l.hier ? 0.9 : 0.5)),
		)
		// short-range repulsion and a weak, wider-than-tall pull to the centre: clusters keep their own shape instead
		// of being pressed into one disc
		.force('charge', forceManyBody<N>().strength(-150).theta(0.9).distanceMax(320))
		.force('collide', forceCollide<N>((d) => d.r + 8).iterations(2))
		.force('x', forceX<N>(0).strength(0.012))
		.force('y', forceY<N>(0).strength(0.03))
		.stop();
	if (seeded) sim.alpha(0.5);
	const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
	sim.tick(ticks);
	const positions: ForceResponse['positions'] = {};
	for (const n of nodes) positions[n.id] = [Math.round(n.x! * 10) / 10, Math.round(n.y! * 10) / 10];
	postMessage({ requestId: data.requestId, positions } satisfies ForceResponse);
});
