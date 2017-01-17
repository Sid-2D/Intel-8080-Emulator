"use strict";

let displayWidth = 256, displayHeight = 224;
let displayMatrix = new Uint8Array(256 * 224);
 
function setMatrix () {
	for (let i = 0; i < displayHeight; i++) {
		for (let j = 0; j < 32; j++) {
			for (let k = 0; k < 8; k++) {
				displayMatrix[(i * displayWidth + j) + k + (j * 8)] = CPU.RAM[0x2400 + i * 32 + j] & (1 << k);
			}
		}
	}
}