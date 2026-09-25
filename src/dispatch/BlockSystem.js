// Blocuri de linie (simulare BLA). Un tronson dublu = 2 blocuri PE SENS, cu granița
// la BLOCK_BOUNDARY din progresul tronsonului; un tronson simplu = UN bloc comun
// ambelor sensuri, rezervat integral încă de la plecare (exclude fizic sensul opus).
// Rezervarea e exclusivă: cererea unui bloc deja ocupat de alt tren este refuzată.
export const BLOCK_BOUNDARY = 0.48;

export function blockPlan(edge, from, to) {
    if (edge.double) return [`${edge.id}:${from}>${to}:0`, `${edge.id}:${from}>${to}:1`];
    return [`${edge.id}:S`];
}

export const BlockSystemMixin = {
    blockOwner(key) { return this.blocks.get(key) || null; },
    blockFree(key, exceptId = null) { const o = this.blocks.get(key); return !o || o === exceptId; },
    reserveBlock(key, trainId) {
        const o = this.blocks.get(key);
        if (o && o !== trainId) return false;
        this.blocks.set(key, trainId);
        return true;
    },
    releaseBlock(key, trainId) { if (this.blocks.get(key) === trainId) this.blocks.delete(key); },
    releaseTrainBlocks(t) { (t.blockKeys || []).forEach(k => this.releaseBlock(k, t.id)); t.blockKeys = []; }
};
