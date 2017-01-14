"use strict";
var CPU;

function initCPU () {
	CPU = loadCPU();
	setOpcodes();
	loadProgram();
}

// Globals for referring to registers
var A = 7, B = 0, C = 1, D = 2, E = 3, H = 4, L = 5;

// Register pair numbers
var BC = 0, DE = 1, HL = 2, SP = 3;

// Flag numbers
var S = 0, Z = 1, P = 2, CY = 3, AC = 4;

function loadCPU () {
	return {
		// 1 16-bit registers
		programCounter : 0,
		// Seven 8-bit registers and one more for SP
		// A: 7, B: 0, C: 1, D: 2, E: 3, H: 4, L: 5 
		registers : new Uint8Array(8),
		// A duplicate array for register pairs for fast access
		registerPairs : new Uint16Array(4),
		// 5 1-bit flags
		flags : new Uint8Array(5),
		// RAM
		RAM : new Uint8Array(65536),
		// Wait - Used for memory sync
		State : {
			WAIT : false,
			HLDA : false,
			HLTA : false,
			INTE : false
		},
		// OpCodes
		Instructions : new Array(256)
	} 
}

function resetCPU () {
	CPU = loadCPU();
	loadProgram();
}

function loadProgram () {
	var xhr = new XMLHttpRequest;
	xhr.open("GET", "ROM/DEBUG", true);
	xhr.responseType = "arraybuffer";
	xhr.onload = function () {
		var program = new Uint8Array(xhr.response);
		// console.log(program);
		for (var i = 0; i < program.length; i++) {
			CPU.RAM[i] = program[i];
		}
		// console.log(CPU.RAM);
		start();
	};
	xhr.send();
}

function start () {
	requestAnimationFrame(function update() {
		processOpcode();
		if (!CPU.State.WAIT) {
			requestAnimationFrame(update);
		} 
	});
}

function setOpcodes () {
	for (var i = 0; i < 256; i++) {
		CPU.Instructions[i] = function () {
			console.log("\tINVALID OPCODE.");
			wait();
		}
	}
	CPU.Instructions[0x00] = function () {
		// NOP
		console.log("\tNOP");
	};
	CPU.Instructions[0x01] = function () {
		// LXI B, D16
		CPU.registers[C] = CPU.RAM[CPU.programCounter++];
		CPU.registers[B] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x02] = function () {
		// STAX B
		var address = (CPU.registers[B] << 8) | CPU.registers[C];
		CPU.RAM[address] = CPU.registers[A];
	};
	CPU.Instructions[0x03] = function () {
		// INX B
		CPU.registerPairs[0]++;
		syncRegisterWithPair(B, BC);
	};
	CPU.Instructions[0x04] = function () {
		// INR B
		setFlagACplus(CPU.registers[B], 1);
		CPU.registers[B]++;
		syncPairWithRegister(B, BC);
		setFlagZ(CPU.registers[B]);
		setFlagS(CPU.registers[B]);
		setFlagP(CPU.registers[B]);
	};
	CPU.Instructions[0x05] = function () {
		// DCR B
		setFlagACminus(CPU.registers[B], 1);	
		CPU.registers[B]--;
		syncPairWithRegister(B, BC);
		setFlagZ(CPU.registers[B]);
		setFlagS(CPU.registers[B]);
		setFlagP(CPU.registers[B]);
	};
	CPU.Instructions[0x06] = function () {
		// MVI B, D8
		CPU.registers[B] = CPU.RAM[programCounter++];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x07] = function () {
		// RLC
		var d7 = (1 << 7) & CPU.registers[A];
		d7 = d7 >> 7;
		CPU.flags[CY] = d7; 
		CPU.registers[A] = CPU.registers[A] << 1;
		CPU.registers[A] = CPU.registers[A] | d7;
	};
	CPU.Instructions[0x09] = function () {
		// DAD B
		var temp = CPU.registerPairs[HL];
		CPU.registerPairs[HL] += CPU.registerPairs[BC];
		syncRegisterWithPair(H, HL);
		setFlagCY(temp + CPU.registerPairs[BC], CPU.registerPairs[HL]); 
	};
	CPU.Instructions[0x0a] = function () {
		// LDAX B
		CPU.registers[A] = CPU.RAM[CPU.registerPairs[BC]];
	};
	CPU.Instructions[0x0b] = function () {
		// DCX B
		CPU.registerPairs[BC]--;
		syncRegisterWithPair(B, BC);
	};
	CPU.Instructions[0x0c] = function () {
		// INR C
		setFlagACplus(CPU.registers[C], 1);
		CPU.registers[C]++;
		syncPairWithRegister(B, BC);
		setFlagZ(CPU.registers[C]);
		setFlagS(CPU.registers[C]);
		setFlagP(CPU.registers[C]);
	};
	CPU.Instructions[0x0d] = function () {
		// DCR C
		setFlagACminus(CPU.registers[C], 1);
		CPU.registers[C]--;
		syncPairWithRegister(B, BC);
		setFlagZ(CPU.registers[C]);
		setFlagS(CPU.registers[C]);
		setFlagP(CPU.registers[C]);
	};
	CPU.Instructions[0x0e] = function () {
		// MVI C, D8
		CPU.registers[C] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x0f] = function () {
		// RRC
		var d0 = 1 & CPU.registers[A];
		CPU.flags[CY] = d0;
		CPU.registers[A] = CPU.registers[A] >> 1;
		CPU.registers[A] = CPU.registers[A] | (d0 << 7);
	};
	CPU.Instructions[0x11] = function () {
		// LXI D, D16
		CPU.registers[E] = CPU.RAM[CPU.programCounter++];
		CPU.registers[D] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x12] = function () {
		// STAX D
		CPU.RAM[CPU.registerPairs[DE]] = CPU.registers[A];
	};
	CPU.Instructions[0x13] = function () {
		// INX D
		CPU.registerPairs[DE]++;
		syncRegisterWithPair(D, DE);
	};
	CPU.Instructions[0x14] = function () {
		// INR D
		setFlagACplus(CPU.registers[D], 1);
		CPU.registers[D]++;
		syncPairWithRegister(D, DE);
		setFlagZ(CPU.registers[D]);
		setFlagS(CPU.registers[D]);
		setFlagP(CPU.registers[D]);
	};
	CPU.Instructions[0x15] = function () {
		// DCR D
		setFlagACminus(CPU.registers[D], 1);
		CPU.registers[D]--;
		syncPairWithRegister(D, DE);
		setFlagZ(CPU.registers[D]);
		setFlagS(CPU.registers[D]);
		setFlagP(CPU.registers[D]);
	};
	CPU.Instructions[0x16] = function () {
		// MVI D, D8
		CPU.registers[D] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(D, 1);
	};
	CPU.Instructions[0x17] = function () {
		// RAL
		var d0 = CPU.flags[CY];
		CPU.flags[CY] = (CPU.registers[A] & (1 << 7)) >> 7;
		CPU.registers[A] = CPU.registers[A] << 1;
		CPU.registers[A] = d0 | CPU.registers[A];
	};
	CPU.Instructions[0x19] = function () {
		// DAD D
		var temp = CPU.registerPairs[HL];
		CPU.registerPairs[HL] += CPU.registerPairs[DE];
		syncRegisterWithPair(H, HL);
		setFlagCY(temp + CPU.registerPairs[DE], CPU.registerPairs[HL]);
	};
	CPU.Instructions[0x1a] = function () {
		// LDAX D
		CPU.registers[A] = CPU.RAM[CPU.registerPairs[DE]];
	};
	CPU.Instructions[0x1b] = function () {
		// DCX D
		CPU.registerPairs[DE]--;
		syncRegisterWithPair(D, DE);
	};
	CPU.Instructions[0x1c] = function () {
		// INR E
		setFlagACplus(CPU.registers[E], 1);
		CPU.registers[E]++;
		syncPairWithRegister(D, DE);
		setFlagZ(CPU.registers[E]);
		setFlagP(CPU.registers[E]);
		setFlagS(CPU.registers[E]);
	};
	CPU.Instructions[0x1d] = function () {
		// DCR E
		setFlagACminus(CPU.registers[E], 1);
		CPU.registers[E]--;
		syncPairWithRegister(D, DE);
		setFlagZ(CPU.registers[E]);
		setFlagP(CPU.registers[E]);
		setFlagS(CPU.registers[E]);
	};
	CPU.Instructions[0x1e] = function () {
		// MVI E, D8
		CPU.registers[E] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x1f] = function () {
		// RAR
		var d0 = 1 & CPU.registers[A];
		var d7 = CPU.flags[CY] << 7;
		CPU.registers[A] = CPU.registers[A] >> 1;
		CPU.registers[A] = CPU.registers[A] | d7;		
		CPU.flags[CY] = d0;
	};
	CPU.Instructions[0x21] = function () {
		// LXI H, D16
		CPU.registers[L] = CPU.RAM[CPU.programCounter++];
		CPU.registers[H] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x22] = function () {
		// SHLD adr
		var address = getAddress()
		CPU.RAM[address] = CPU.registers[L];
		CPU.RAM[address + 1] = CPU.registers[H];
	};
	CPU.Instructions[0x23] = function () {
		// INX H
		CPU.registerPairs[HL]++;
		syncRegisterWithPair(H, HL);
	};
	CPU.Instructions[0x24] = function () {
		// INR H
		setFlagACplus(CPU.registers[H], 1);
		CPU.registers[H]++;
		setFlagZ(CPU.registers[H]);
		setFlagP(CPU.registers[H]);
		setFlagS(CPU.registers[H]);
	};
	CPU.Instructions[0x25] = function () {
		// DCR H
		setFlagACminus(CPU.registers[H], 1);
		CPU.registers[H]--;
		setFlagZ(CPU.registers[H]);
		setFlagP(CPU.registers[H]);
		setFlagS(CPU.registers[H]);
	};
	CPU.Instructions[0x26] = function () {
		// MVI H, D8
		CPU.registers[H] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x29] = function () {
		// DAD H
		var temp = CPU.registerPairs[HL];
		CPU.registerPairs[HL] += CPU.registerPairs[HL];
		syncRegisterWithPair(H, HL);
		setFlagCY(temp + CPU.registerPairs[HL], CPU.registerPairs[HL]);
	};
	CPU.Instructions[0x2a] = function () {
		// LHLD adr
		var address = getAddress();
		CPU.registers[L] = CPU.RAM[address];
		CPU.registers[H] = CPU.RAM[address + 1];
	};
	CPU.Instructions[0x2b] = function () {
		// DCX H
		CPU.registerPairs[HL]--;
		syncRegisterWithPair(H, HL);
	};
	CPU.Instructions[0x2c] = function () {
		// INR L
		setFlagACplus(CPU.registers[L], 1);
		CPU.registers[L]++;
		syncPairWithRegister(H, HL);
		setFlagZ(CPU.registers[L]);
		setFlagP(CPU.registers[L]);
		setFlagS(CPU.registers[L]);
	};
	CPU.Instructions[0x2d] = function () {
		// DCR L
		setFlagACminus(CPU.registers[L], 1);
		CPU.registers[L]--;
		setFlagZ(CPU.registers[L]);
		setFlagP(CPU.registers[L]);
		setFlagS(CPU.registers[L]);
	};
	CPU.Instructions[0x2e] = function () {
		// MVI L, D8
		CPU.registers[L] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x2f] = function () {
		// CMA
		CPU.registers[A] = ~CPU.registers[A];
	};
	CPU.Instructions[0x31] = function () {
		// LXI SP, D16
		var lo = CPU.RAM[CPU.programCounter++];
		var hi = CPU.RAM[CPU.programCounter++];
		CPU.registerPairs[SP] = (hi << 8) | lo;
	};
	CPU.Instructions[0x32] = function () {
		// STA adr
		var address = getAddress();
		CPU.RAM[address] = CPU.registers[A];
	};
	CPU.Instructions[0x33] = function () {
		// INX SP
		CPU.registerPairs[SP]++;
	};
	CPU.Instructions[0x34] = function () {
		// INR M
		var M = CPU.registerPairs[HL];
		setFlagACplus(CPU.RAM[M], 1);
		CPU.RAM[M]++;
		setFlagZ(CPU.RAM[M]);
		setFlagP(CPU.RAM[M]);
		setFlagS(CPU.RAM[M]);
	};
	CPU.Instructions[0x35] = function () {
		// DCR M
		var M = CPU.registerPairs[HL];
		setFlagACminus(CPU.RAM[M], 1);
		CPU.RAM[M]--;
		setFlagZ(CPU.RAM[M]);
		setFlagP(CPU.RAM[M]);
		setFlagS(CPU.RAM[M]);
	};
	CPU.Instructions[0x36] = function () {
		// MVI M, D8
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.RAM[CPU.programCounter++];
	};
	CPU.Instructions[0x37] = function () {
		// STC
		CPU.flags[CY] = 1;
	};
	CPU.Instructions[0x39] = function () {
		// DAD SP
		var temp = CPU.registerPairs[HL];
		CPU.registerPairs[HL] += CPU.registerPairs[SP];
		syncRegisterWithPair(H, HL);
		setFlagCY(temp + CPU.registerPairs[SP], CPU.registerPairs[HL]);
	};
	CPU.Instructions[0x3a] = function () {
		// LDA adr
		var address = getAddress();
		CPU.registers[A] = CPU.RAM[address];
	};
	CPU.Instructions[0x3b] = function () {
		// DCX SP
		CPU.registerPairs[SP]--;
	};
	CPU.Instructions[0x3c] = function () {
		// INR A
		setFlagACplus(CPU.registers[A], 1);
		CPU.registers[A]++;
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0x3d] = function () {
		// DCR A
		setFlagACminus(CPU.registers[A], 1);
		CPU.registers[A]--;
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0x3e] = function () {
		// MVI A, D8
		CPU.registers[A] = CPU.RAM[CPU.programCounter++];
	};
	CPU.Instructions[0x3f] = function () {
		// CMC
		CPU.flags[CY] = (~CPU.flags[CY]) & 1;
	};
	CPU.Instructions[0x40] = function () {
		// MOV B, B
		CPU.registers[B] = CPU.registers[B];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x41] = function () {
		// MOV B, C
		CPU.registers[B] = CPU.registers[C];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x42] = function () {
		// MOV B, D
		CPU.registers[B] = CPU.registers[D];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x43] = function () {
		// MOV B, E
		CPU.registers[B] = CPU.registers[E];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x44] = function () {
		// MOV B, H
		CPU.registers[B] = CPU.registers[H];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x45] = function () {
		// MOV B, L
		CPU.registers[B] = CPU.registers[L];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x46] = function () {
		// MOV B, M
		var M = CPU.registerPairs[HL];
		CPU.registers[B] = CPU.RAM[M];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x47] = function () {
		// MOV B, A
		CPU.registers[B] = CPU.registers[A];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x48] = function () {
		// MOV C, B
		CPU.registers[C] = CPU.registers[B];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x49] = function () {
		// MOV C, C
		CPU.registers[C] = CPU.registers[C];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4a] = function () {
		// MOV C, D
		CPU.registers[C] = CPU.registers[D];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4b] = function () {
		// MOV C, E
		CPU.registers[C] = CPU.registers[E];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4c] = function () {
		// MOV C, H
		CPU.registers[C] = CPU.registers[H];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4d] = function () {
		// MOV C, L
		CPU.registers[C] = CPU.registers[L];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4e] = function () {
		// MOV C, M
		var M = CPU.registerPairs[HL];
		CPU.registers[C] = CPU.RAM[M];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x4f] = function () {
		// MOV C, A
		CPU.registers[C] = CPU.registers[A];
		syncPairWithRegister(B, BC);
	};
	CPU.Instructions[0x50] = function () {
		// MOV D, B
		CPU.registers[D] = CPU.registers[B];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x51] = function () {
		// MOV D, C
		CPU.registers[D] = CPU.registers[C];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x52] = function () {
		// MOV D, D
		CPU.registers[D] = CPU.registers[D];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x53] = function () {
		// MOV D, E
		CPU.registers[D] = CPU.registers[E];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x54] = function () {
		// MOV D, H
		CPU.registers[D] = CPU.registers[H];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x55] = function () {
		// MOV D, L
		CPU.registers[D] = CPU.registers[L];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x56] = function () {
		// MOV D, M
		var M = CPU.registerPairs[HL];
		CPU.registers[D] = CPU.RAM[M];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x57] = function () {
		// MOV D, L
		CPU.registers[D] = CPU.registers[A];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x58] = function () {
		// MOV E, B
		CPU.registers[E] = CPU.registers[B];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x59] = function () {
		// MOV E, C
		CPU.registers[E] = CPU.registers[C];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5a] = function () {
		// MOV E, D
		CPU.registers[E] = CPU.registers[D];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5b] = function () {
		// MOV E, E
		CPU.registers[E] = CPU.registers[E];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5c] = function () {
		// MOV E, H
		CPU.registers[E] = CPU.registers[H];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5d] = function () {
		// MOV E, L
		CPU.registers[E] = CPU.registers[L];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5e] = function () {
		// MOV E, M
		var M = CPU.registerPairs[HL];
		CPU.registers[E] = CPU.RAM[M];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x5f] = function () {
		// MOV E, A
		CPU.registers[E] = CPU.registers[A];
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0x60] = function () {
		// MOV H, B
		CPU.registers[H] = CPU.registers[B];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x61] = function () {
		// MOV H, C
		CPU.registers[H] = CPU.registers[C];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x62] = function () {
		// MOV H, D
		CPU.registers[H] = CPU.registers[D];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x63] = function () {
		// MOV H, E
		CPU.registers[H] = CPU.registers[E];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x64] = function () {
		// MOV H, H
		CPU.registers[H] = CPU.registers[H];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x65] = function () {
		// MOV H, L
		CPU.registers[H] = CPU.registers[L];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x66] = function () {
		// MOV H, M
		var M = CPU.registerPairs[HL];
		CPU.registers[H] = CPU.RAM[M];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x67] = function () {
		// MOV H, A
		CPU.registers[H] = CPU.registers[A];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x68] = function () {
		// MOV L, B
		CPU.registers[L] = CPU.registers[B];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x69] = function () {
		// MOV L, C
		CPU.registers[L] = CPU.registers[C];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6a] = function () {
		// MOV L, D
		CPU.registers[L] = CPU.registers[D];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6b] = function () {
		// MOV L, E
		CPU.registers[L] = CPU.registers[E];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6c] = function () {
		// MOV L, H
		CPU.registers[L] = CPU.registers[H];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6d] = function () {
		// MOV L, L
		CPU.registers[L] = CPU.registers[L];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6e] = function () {
		// MOV L, M
		var M = CPU.registerPairs[HL];
		CPU.registers[L] = CPU.RAM[M];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x6f] = function () {
		// MOV L, A
		CPU.registers[L] = CPU.registers[A];
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0x70] = function () {
		// MOV M, B
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[B];
	};
	CPU.Instructions[0x71] = function () {
		// MOV M, C
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[C];
	};
	CPU.Instructions[0x72] = function () {
		// MOV M, D
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[D];
	};
	CPU.Instructions[0x73] = function () {
		// MOV M, E
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[E];
	};
	CPU.Instructions[0x74] = function () {
		// MOV M, H
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[H];
	};
	CPU.Instructions[0x75] = function () {
		// MOV M, L
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[L];
	};
	CPU.Instructions[0x76] = function () {
		// HLT
		CPU.State[HLTA] = true;
	};
	CPU.Instructions[0x77] = function () {
		// MOV M, A
		var M = CPU.registerPairs[HL];
		CPU.RAM[M] = CPU.registers[A];
	};
	CPU.Instructions[0x78] = function () {
		// MOV A, B
		CPU.registers[A] = CPU.registers[B];
	};
	CPU.Instructions[0x79] = function () {
		// MOV A, C
		CPU.registers[A] = CPU.registers[C];
	};
	CPU.Instructions[0x7a] = function () {
		// MOV A, D
		CPU.registers[A] = CPU.registers[D];
	};
	CPU.Instructions[0x7b] = function () {
		// MOV A, E
		CPU.registers[A] = CPU.registers[E];
	};
	CPU.Instructions[0x7c] = function () {
		// MOV A, H
		CPU.registers[A] = CPU.registers[H];
	};
	CPU.Instructions[0x7d] = function () {
		// MOV A, L
		CPU.registers[A] = CPU.registers[L];
	};
	CPU.Instructions[0x7e] = function () {
		// MOV A, M
		var M = CPU.registerPairs[HL]
		CPU.registers[A] = CPU.RAM[M];
	};
	CPU.Instructions[0x7f] = function () {
		// MOV A, A
		CPU.registers[A] = CPU.registers[A];
	};
	CPU.Instructions[0x80] = function () {
		// ADD B
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[B]);
		CPU.registers[A] += CPU.registers[B];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[B], CPU.registers[A]);
	};
	CPU.Instructions[0x81] = function () {
		// ADD C
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[C]);
		CPU.registers[A] += CPU.registers[C];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[C], CPU.registers[A]);
	};
	CPU.Instructions[0x82] = function () {
		// ADD D
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[D]);
		CPU.registers[A] += CPU.registers[D];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[D], CPU.registers[A]);
	};
	CPU.Instructions[0x83] = function () {
		// ADD E
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[E]);
		CPU.registers[A] += CPU.registers[E];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[E], CPU.registers[A]);
	};
	CPU.Instructions[0x84] = function () {
		// ADD H
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[H]);
		CPU.registers[A] += CPU.registers[H];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[H], CPU.registers[A]);
	};
	CPU.Instructions[0x85] = function () {
		// ADD L
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[L]);
		CPU.registers[A] += CPU.registers[L];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[L], CPU.registers[A]);
	};
	CPU.Instructions[0x86] = function () {
		// ADD M
		var M = CPU.registerPairs[HL];
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.RAM[M]);
		CPU.registers[A] += CPU.RAM[M];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.RAM[M], CPU.registers[A]);
	};
	CPU.Instructions[0x87] = function () {
		// ADD A
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[A]);
		CPU.registers[A] += CPU.registers[A];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + temp, CPU.registers[A]);
	};
	CPU.Instructions[0x88] = function () {
		// ADC B
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[B] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[B] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[B] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x89] = function () {
		// ADC C
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[C] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[C] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[C] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8a] = function () {
		// ADC D
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[D] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[D] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[D] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8b] = function () {
		// ADC E
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[E] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[E] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[E] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8c] = function () {
		// ADC H
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[H] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[H] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[H] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8d] = function () {
		// ADC L
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[L] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[L] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.registers[L] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8e] = function () {
		// ADC M
		var temp = CPU.registers[A];
		var M = CPU.registerPairs[HL];
		setFlagACplus(CPU.registers[A], CPU.RAM[M] + CPU.flags[CY]);
		CPU.registers[A] += CPU.RAM[M] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + CPU.RAM[M] + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x8f] = function () {
		// ADC A
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], CPU.registers[A] + CPU.flags[CY]);
		CPU.registers[A] += CPU.registers[A] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp + temp + CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x90] = function () {
		// SUB B
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[B]);
		CPU.registers[A] -= CPU.registers[B];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[B], CPU.registers[A]);
	};
	CPU.Instructions[0x91] = function () {
		// SUB C
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[C]);
		CPU.registers[A] -= CPU.registers[C];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[C], CPU.registers[A]);
	};
	CPU.Instructions[0x92] = function () {
		// SUB D
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[D]);
		CPU.registers[A] -= CPU.registers[D];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[D], CPU.registers[A]);
	};
	CPU.Instructions[0x93] = function () {
		// SUB E
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[E]);
		CPU.registers[A] -= CPU.registers[E];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[E], CPU.registers[A]);
	};
	CPU.Instructions[0x94] = function () {
		// SUB H
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[H]);
		CPU.registers[A] -= CPU.registers[H];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[H], CPU.registers[A]);
	};
	CPU.Instructions[0x95] = function () {
		// SUB L
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[L]);
		CPU.registers[A] -= CPU.registers[L];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[L], CPU.registers[A]);
	};
	CPU.Instructions[0x96] = function () {
		// SUB M
		var M = CPU.registerPairs[HL];
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.RAM[M]);
		CPU.registers[A] -= CPU.RAM[M];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.RAM[M], CPU.registers[A]);
	};
	CPU.Instructions[0x97] = function () {
		// SUB A
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[A]);
		CPU.registers[A] -= CPU.registers[A];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - temp, CPU.registers[A]);
	};
	CPU.Instructions[0x98] = function () {
		// SBB B
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[B] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[B] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[B] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x99] = function () {
		// SBB C
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[C] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[C] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[C] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9a] = function () {
		// SBB D
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[D] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[D] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[D] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9b] = function () {
		// SBB E
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[E] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[E] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[E] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9c] = function () {
		// SBB H
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[H] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[H] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[H] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9d] = function () {
		// SBB L
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[L] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[L] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.registers[L] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9e] = function () {
		// SBB M
		var M = CPU.registerPairs[HL];
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.RAM[M] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.RAM[M] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - CPU.RAM[M] - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0x9f] = function () {
		// SBB A
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], CPU.registers[A] + CPU.flags[CY]);
		CPU.registers[A] -= CPU.registers[A] + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagCY(temp - temp - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0xa0] = function () {
		// ANA B
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[B]); 
		CPU.registers[A] = CPU.registers[A] & CPU.registers[B];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa1] = function () {
		// ANA C
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[C]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[C];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa2] = function () {
		// ANA D
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[D]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[D];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa3] = function () {
		// ANA E
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[E]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[E];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa4] = function () {
		// ANA H
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[H]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[H];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa5] = function () {
		// ANA L
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[L]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[L];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa6] = function () {
		// ANA M, Note: The 8080 logical AND instructions set the AC flag to reflect the logical OR of bit 3 of the values involved in the AND operation
		var M = CPU.registerPairs[HL];
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.RAM[M]);
		CPU.registers[A] = CPU.registers[A] & CPU.RAM[M];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa7] = function () {
		// ANA A
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & CPU.registers[A]);
		CPU.registers[A] = CPU.registers[A] & CPU.registers[A];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xa8] = function () {
		// XRA B
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[B];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xa9] = function () {
		// XRA C
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[C];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xaa] = function () {
		// XRA D
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[D];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xab] = function () {
		// XRA E
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[E];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xac] = function () {
		// XRA H
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[H];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xad] = function () {
		// XRA L
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[L];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xae] = function () {
		// XRA M
		var M = CPU.registerPairs[HL];
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.RAM[M];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xaf] = function () {
		// XRA A
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ CPU.registers[A];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb0] = function () {
		// ORA B
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[B];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb1] = function () {
		// ORA C
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[C];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb2] = function () {
		// ORA D
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[D];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb3] = function () {
		// ORA E
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[E];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb4] = function () {
		// ORA H
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[H];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb5] = function () {
		// ORA L
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[L];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb6] = function () {
		// ORA M
		var M = CPU.registerPairs[HL];
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.RAM[M];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb7] = function () {
		// ORA A
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | CPU.registers[A];
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xb8] = function () {
		// CMP B
		if (CPU.registers[A] == CPU.registers[B]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[B]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xb9] = function () {
		// CMP C
		if (CPU.registers[A] == CPU.registers[C]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[C]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xba] = function () {
		// CMP D
		if (CPU.registers[A] == CPU.registers[D]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[D]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xbb] = function () {
		// CMP E
		if (CPU.registers[A] == CPU.registers[E]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[E]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xbc] = function () {
		// CMP H
		if (CPU.registers[A] == CPU.registers[H]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[H]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xbd] = function () {
		// CMP L
		if (CPU.registers[A] == CPU.registers[L]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.registers[L]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xbe] = function () {
		// CMP M
		var M = CPU.registerPairs[HL];
		if (CPU.registers[A] == CPU.RAM[M]) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < CPU.RAM[M]) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xbf] = function () {
		// CMP A
		if (CPU.registers[A] == CPU.registers[A]) {
			CPU.flags[Z] = 1;
			CPU.flags[CY] = 0;
		} else if (CPU.registers[A] < CPU.registers[A]) {
			CPU.flags[CY] = 1;
			CPU.flags[Z] = 0;
		}
	};
	CPU.Instructions[0xc0] = function () {
		// RNZ
		if (!CPU.flags[Z]) {
			var topHi = CPU.RAM[CPU.registerPairs[SP] + 1];
			var topLo = CPU.RAM[CPU.registerPairs[SP]];
			CPU.programCounter = (topHi << 8) | topLo;
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xc1] = function () {
		// POP B
		CPU.registers[C] = CPU.RAM[CPU.registerPairs[SP]];
		CPU.registers[B] = CPU.RAM[CPU.registerPairs[SP] + 1];
		syncPairWithRegister(B, BC);
		CPU.registerPairs[SP] += 2;
	};
	CPU.Instructions[0xc2] = function () {
		// JNZ adr
		var address = getAddress();
		if (CPU.flags[Z]) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xc3] = function () {
		// JMP adr
		var address = getAddress();
		CPU.programCounter = address;
	};
	CPU.Instructions[0xc4] = function () {
		// CNZ adr
		var address = getAddress();
		if (!CPU.flags[Z]) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xc5] = function () {
		// PUSH B
		CPU.RAM[CPU.registerPairs[SP] - 1] = CPU.registers[B];
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.registers[C];
		CPU.registerPairs[SP] -= 2;
	};
	CPU.Instructions[0xc6] = function () {
		// ADI D8
		var value = CPU.RAM[CPU.programCounter++];
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], value);
		CPU.registers[A] += value;
		setFlagZ(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagCY(temp + value, CPU.registers[A]);
	};
	CPU.Instructions[0xc7] = function () {
		// RST 0
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00f0;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x00;
	};
	CPU.Instructions[0xc8] = function () {
		// RZ
		if (CPU.flags[Z]) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xc9] = function () {
		// RET
		CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
		CPU.registerPairs[SP] += 2;
	};
	CPU.Instructions[0xca] = function () {
		// JZ adr
		var address = getAddress();
		if (CPU.flags[Z]) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xcc] = function () {
		// CZ adr
		var address = getAddress();
		if (CPU.flags[C]) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xcd] = function () {
		// CALL adr
		var address = getAddress();
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = address;
	};
	CPU.Instructions[0xce] = function () {
		// ACI D8
		var value = CPU.RAM[CPU.programCounter++];
		var temp = CPU.registers[A];
		setFlagACplus(CPU.registers[A], value + 1);
		CPU.registers[A] += value + 1;
		setFlagZ(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagCY(temp + value + 1, CPU.registers[A]);
	};
	CPU.Instructions[0xcf] = function () {
		// RST 1
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2]  = CPU.programCounter & 0xff00;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x08;
	};
	CPU.Instructions[0xd0] = function () {
		// RNC
		if (!CPU.flags[CY]) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xd1] = function () {
		// POP D
		CPU.registers[E] = CPU.RAM[CPU.registerPairs[SP]];
		CPU.registers[D] = CPU.RAM[CPU.registerPairs[SP] + 1];
		syncPairWithRegister(D, DE);
		CPU.registerPairs[SP] += 2;
	};
	CPU.Instructions[0xd2] = function () {
		// JNC adr
		var address = getAddress();
		if (!CPU.flags[CY]) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xd3] = function () {
		// OUT D8
		var port = CPU.RAM[CPU.programCounter++];
		document.getElementById('Display').innerHTML += String.fromCharCode(CPU.registers[A]);
	};
	CPU.Instructions[0xd4] = function () {
		// CNC adr
		var address = getAddress();
		if (!CPU.flags[CY]) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xd5] = function () {
		// PUSH D
		CPU.RAM[CPU.registerPairs[SP] - 1] = CPU.registers[D];
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.registers[E];
		CPU.registerPairs[SP] -= 2;
	};
	CPU.Instructions[0xd6] = function () {
		// SUI D8
		var value = CPU.RAM[CPU.programCounter++];
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], value);
		CPU.registers[A] -= value;
		setFlagZ(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagCY(temp - value, CPU.registers[A]);
	};
	CPU.Instructions[0xd7] = function () {
		// RST 2
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
		CPU.registerPairs[SP] += 2;
		CPU.programCounter = 0x10;
	};
	CPU.Instructions[0xd8] = function () {
		// RC
		if (CPU.flags[CY]) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xda] = function () {
		// JC adr
		var address = getAddress();
		if (CPU.flags[CY]) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xdb] = function () {
		// IN D8
	};
	CPU.Instructions[0xdc] = function () {
		// CC adr
		var address = getAddress();
		if (CPU.flags[CY]) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xde] = function () {
		// SBI D8
		var value = CPU.RAM[CPU.programCounter++];
		var temp = CPU.registers[A];
		setFlagACminus(CPU.registers[A], value + CPU.flags[CY]);
		CPU.registers[A] -= value + CPU.flags[CY];
		setFlagZ(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagCY(temp - value - CPU.flags[CY], CPU.registers[A]);
	};
	CPU.Instructions[0xdf] = function () {
		// RST 3
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x18;
	};
	CPU.Instructions[0xe0] = function () {
		// RPO
		if (CPU.flags[P] == 0) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xe1] = function () {
		// POP H
		CPU.registers[L] = CPU.RAM[CPU.registerPairs[SP]];
		CPU.registers[H] = CPU.RAM[CPU.registerPairs[SP] + 1];
		syncPairWithRegister(H, HL);
		CPU.registerPairs[SP] += 2;
	};
	CPU.Instructions[0xe2] = function () {
		// JPO adr
		var address = getAddress();
		if (flags[P] == 0) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xe3] = function () {
		// XTHL
		var temp = CPU.registers[L];
		CPU.registers[L] = CPU.RAM[CPU.registerPairs[SP]];
		CPU.RAM[CPU.registerPairs[SP]] = temp;
		temp = CPU.registers[H];
		CPU.registers[H] = CPU.RAM[CPU.registerPairs[SP] + 1];
		CPU.RAM[CPU.registerPairs[SP]] = temp;
		syncPairWithRegister(H, HL);
	};
	CPU.Instructions[0xe4] = function () {
		// CPO adr
		var address = getAddress();
		if (CPU.flags[P] == 0) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xe5] = function () {
		// PUSH H
		CPU.RAM[CPU.registerPairs[SP] - 1] = CPU.registers[H];
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.registers[L];
		CPU.registerPairs[SP] -= 2;
	};
	CPU.Instructions[0xe6] = function () {
		// ANI D8
		var value = CPU.RAM[CPU.programCounter++];
		CPU.flags[AC] = (0x8 & CPU.registers[A]) | (0x8 & value); 
		CPU.registers[A] = CPU.registers[A] & value;
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
		CPU.flags[CY] = 0;
	};
	CPU.Instructions[0xe7] = function () {
		// RST 4
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00f0;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x20;
	};
	CPU.Instructions[0xe8] = function () {
		if (CPU.flags[P] == 1) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xe9] = function () {
		// PCHL
		CPU.programCounter = (CPU.registers[H] << 8) | CPU.registers[L];
	};
	CPU.Instructions[0xea] = function () {
		// JPE adr
		var address = getAddress();
		if (flags[P] == 1) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xeb] = function () {
		// XCHG
		var temp = CPU.registers[H];
		CPU.registers[H] = CPU.registers[D];
		CPU.registers[D] = temp;
		temp = CPU.registers[L];
		CPU.registers[L] = CPU.registers[E];
		CPU.registers[E] = temp;
		syncPairWithRegister(H, HL);
		syncPairWithRegister(D, DE);
	};
	CPU.Instructions[0xec] = function () {
		// CPE adr
		var address = getAddress();
		if (CPU.flags[P] == 1) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xee] = function () {
		// XRI D8
		var value = CPU.RAM[CPU.programCounter++];
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] ^ value;
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xef] = function () {
		// RST 5
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00f0;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x28;
	};
	CPU.Instructions[0xf0] = function () {
		// RP
		if (CPU.flags[S] == 0) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xf1] = function () {
		// POP PSW
		CPU.registers[A] = CPU.RAM[CPU.registerPairs[SP] + 1];
		var value = CPU.RAM[CPU.registerPairs[SP]];
		CPU.flags[CY] = (value & 1);
		CPU.flags[P] = (value & (1 << 2)) >> 2;
		CPU.flags[AC] = (value & (1 << 4)) >> 4;
		CPU.flags[Z] = (value & (1 << 6)) >> 6;
		CPU.flags[S] = (value & (1 << 7)) >> 7;
		CPU.registerPairs[SP] += 2;
	};
	CPU.Instructions[0xf2] = function () {
		// JP adr
		var address = getAddress();
		if (CPU.flags[S] == 0) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xf3] = function () {
		// DI
		CPU.State[INTE] = false;
	};
	CPU.Instructions[0xf4] = function () {
		// CP adr
		var address = getAddress();
		if (CPU.flags[S] == 0) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00ff;
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xf5] = function () {
		// PUSH PSW
		var value = 0x02;
		value |= CPU.flags[CY];
		value |= CPU.flags[P] << 2;
		value |= CPU.flags[AC] << 4;
		value |= CPU.flags[Z] << 6;
		value |= CPU.flags[S] << 7;
		CPU.RAM[CPU.registerPairs[SP] - 2] = value;
		CPU.RAM[CPU.registerPairs[SP] - 1] = CPU.registers[A];
		CPU.registerPairs[SP] -= 2;
	};
	CPU.Instructions[0xf6] = function () {
		// ORI D8
		var value = CPU.RAM[CPU.programCounter++];
		CPU.flags[AC] = CPU.flags[CY] = 0;
		CPU.registers[A] = CPU.registers[A] | value;
		setFlagZ(CPU.registers[A]);
		setFlagP(CPU.registers[A]);
		setFlagS(CPU.registers[A]);
	};
	CPU.Instructions[0xf7] = function () {
		// RST 6
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00f0;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x30;
	};
	CPU.Instructions[0xf8] = function () {
		// RM
		if (CPU.flags[S] == 1) {
			CPU.programCounter = (CPU.RAM[CPU.registerPairs[SP] + 1] << 8) | CPU.RAM[CPU.registerPairs[SP]];
			CPU.registerPairs[SP] += 2;
		}
	};
	CPU.Instructions[0xf9] = function () {
		// SPHL
		CPU.registerPairs[SP] = CPU.registerPairs[HL];
	};
	CPU.Instructions[0xfa] = function () {
		// JM adr
		var address = getAddress();
		if (CPU.flags[S] == 1) {
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xfb] = function () {
		// EI
		CPU.State[INTE] = true;
	};
	CPU.Instructions[0xfc] = function () {
		// CM adr
		var address = getAddress();
		if (CPU.flags[S] == 1) {
			CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
			CPU.RAM[CPU.registerPairs[SP] - 2] = (CPU.programCounter & 0x00ff);
			CPU.registerPairs[SP] -= 2;
			CPU.programCounter = address;
		}
	};
	CPU.Instructions[0xfe] = function () {
		// CPI D8
		var value = CPU.RAM[CPU.programCounter++];
		if (CPU.registers[A] == value) {
			CPU.flags[Z] = 1;
		} else if (CPU.registers[A] < value) {
			CPU.flags[CY] = 1;
		}
	};
	CPU.Instructions[0xff] = function () {
		// RST 7
		CPU.RAM[CPU.registerPairs[SP] - 1] = (CPU.programCounter & 0xff00) >> 8;
		CPU.RAM[CPU.registerPairs[SP] - 2] = CPU.programCounter & 0x00f0;
		CPU.registerPairs[SP] -= 2;
		CPU.programCounter = 0x38;
	};
}

function getAddress () {
	var byte2 = CPU.RAM[CPU.programCounter++];
	var byte3 = CPU.RAM[CPU.programCounter++];
	return ((byte3 << 8) | byte2);
}

function syncPairWithRegister (r, p) {
	CPU.registerPairs[p] = (CPU.registers[r] << 8) | CPU.registers[r + 1];
}

function syncRegisterWithPair (r, p) {
	CPU.registers[r] = CPU.registerPairs[p] >> 8;
	CPU.registers[r + 1] = (CPU.registerPairs[p] & 0x00ff);
}

function setFlagZ (result) {
	if (result == 0) {
		return CPU.flags[Z] = 1;
	}
	CPU.flags[Z] = 0;
}

function setFlagS (result) {
	if (0x80 & result) {
		return CPU.flags[S] = 1;
	}
	CPU.flags[S] = 1;
}

function setFlagP (result) {
	var ones = 0, mask = 0x80;
	while (mask) {
		if (mask & result) {
			ones++;
		}
		mask = mask >> 1;
	}
	if (ones & 1) {
		return CPU.flags[P] = 0;
	}
	CPU.flags[P] = 1;
}

function setFlagCY (supposed, actual) {
	if (supposed != actual) {
		return CPU.flags[CY] = 1;
	}
	CPU.flags[CY] = 0;
}

function setFlagACplus (before, value) {
	var mask = 1;
	var carry = 0;
	for (var i = 0; i < 4; i++) {
		if ((mask & before) + (mask & value) + carry > 1) {
			carry = 1;
		} else {
			carry = 0;
		}
		mask = mask << 1;
	}
	if (carry) {
		return CPU.flags[AC] = 1;
	}
	CPU.flags[AC] = 0;
}

function setFlagACminus (before, value) {
	var borrow = 0;
	var mask = 1 << 3;
	for (var i = 0; i < 4; i++) {
		if ((mask & before) < (mask & value)) {
			if (borrow) {
				borrow--;
			} else {
				borrow = -1;
				break;
			}
		} else if (mask & before) {
			borrow++;
		}
		mask = mask >> 1;
	}
	if (borrow == -1) {
		return CPU.flags[AC] = 1;
	}
	CPU.flags[AC] = 1;
}

function wait () {
	CPU.State.WAIT = true;
}

function processOpcode () {
	// FETCH
	var opcode = CPU.RAM[CPU.programCounter++];
	// console.log("Processing OpCode: " + opcode.toString(16));
	CPU.Instructions[opcode]();
}