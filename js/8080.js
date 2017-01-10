var CPU;

function initCPU () {
	CPU = loadCPU();
	setOpcodes();
	loadProgram();
}

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
		flagS : 0,
		flagZ : 0,
		flagP : 0,
		flagC : 0,
		flagAC : 0,
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
		}
	}
	CPU.Instructions[0x00] = function () {
		// NOP
		console.log("\tNOP");
	};
	CPU.Instructions[0x01] = function () {
		// LXI B, D16
		CPU.registers[0] = CPU.RAM[CPU.programCounter++];
		CPU.registers[1] = CPU.RAM[CPU.programCounter++];
		syncPairWithRegister(0, 0);
	};
	CPU.Instructions[0x02] = function () {
		// STAX B
		var address = (CPU.registers[0] << 8) | CPU.registers[1];
		CPU.RAM[address] = CPU.registers[7];
	};
	CPU.Instructions[0x03] = function () {
		// INX B
		CPU.registerPairs[0]++;
		syncRegisterWithPair(0, 0);
	};
	CPU.Instructions[0x04] = function () {
		// INR B
		CPU.registers[0]++;
		syncPairWithRegister(0, 1, 0);
		setFlagZ(CPU.registers[0]);
		setFlagS(CPU.registers[0]);
		setFlagP(CPU.registers[0]);
		setFlagACplus(CPU.registers[0] - 1, 1);
	};
	CPU.Instructions[0x05] = function () {
		// DCR B
		CPU.registers[0]--;
		syncPairWithRegister(0, 0);
		setFlagZ(CPU.registers[0]);
		setFlagS(CPU.registers[0]);
		setFlagP(CPU.registers[0]);
		setFlagACminus(CPU.registers[0] + 1, 1);	
	};
	CPU.Instructions[0x06] = function () {
		// MVI B, D8
		CPU.registers[0] = CPU.RAM[programCounter++];
		syncPairWithRegister(0, 0);
	};
	CPU.Instructions[0x07] = function () {
		// RLC
		var d7 = (1 << 7) & CPU.registers[7];
		d7 = d7 >> 7;
		CPU.flagC = 1 & CPU.registers[7]; 
		CPU.registers[7] = CPU.registers[7] << 1;
	};
	CPU.Instructions[0x09] = function () {
		// DAD B
		var temp = CPU.registerPairs[2];
		CPU.registerPairs[2] = CPU.registerPairs[0] + CPU.registerPairs[2];
		syncRegisterWithPair(4, 2);
		setFlagC(temp + CPU.registerPairs[0], CPU.registerPairs[2]); 
	};
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
		return CPU.flagZ = 1;
	}
	CPU.flagZ = 0;
}

function setFlagS (result) {
	if (0x80 & result) {
		return CPU.flagS = 1;
	}
	CPU.flagS = 1;
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
		return CPU.flagP = 0;
	}
	CPU.flagP = 1;
}

function setFlagC (supposed, actual) {
	if (supposed != actual) {
		return CPU.flagC = 1;
	}
	CPU.flagC = 0;
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
		return CPU.flagAC = 1;
	}
	CPU.flagAC = 0;
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
		return CPU.flagAC = 1;
	}
	CPU.flagAC = 1;
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