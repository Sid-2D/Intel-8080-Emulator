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
		// 2 16-bit registers
		programCounter : 0,
		stackPointer : 0,
		// Seven 8-bit registers
		// A: 7, B: 0, C: 1, D: 2, E: 3, H: 4, L: 5 
		registers : new Uint8Array(8),
		// A duplicate array for register pairs for fast access
		registerPairs : new Uint16Array(4),
		// 5 1-bit flags
		flags : new Uint8Array(5);
		// RAM
		RAM : new Uint8Array(65536),
		// Stack for enabling sub-routines with unlimited nesting
		Stack : new Array(),
		// Wait - Used for memory sync
		State : {
			WAIT: false,
			HLDA: false,
			HLTA: false
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
		CPU.stackPointer = CPU.registerPairs[SP];
	};
	CPU.Instructions[0x32] = function () {
		// STA adr
		var address = getAddress();
		CPU.RAM[address] = CPU.registers[A];
	};
	CPU.Instructions[0x33] = function () {
		// INX SP
		CPU.registerPairs[SP]++;
		CPU.stackPointer = CPU.registerPairs[SP];
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
		CPU.stackPointer = CPU.registerPairs[SP];
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
		return CPU.flag[Z] = 1;
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
	console.log("Processing OpCode: " + opcode.toString(16));
	CPU.Instructions[opcode]();
}