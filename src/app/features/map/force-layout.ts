/** Messages exchanged with the force-layout web worker. */
export interface ForceNodeIn {
	id: string;
	/** column index used as a gentle top-down bias (org → system → service → dataset) */
	col: number;
	r: number;
	x?: number;
	y?: number;
}

export interface ForceRequest {
	requestId: number;
	nodes: ForceNodeIn[];
	links: { source: string; target: string; hier: boolean }[];
}

export interface ForceResponse {
	requestId: number;
	positions: Record<string, [number, number]>;
}
