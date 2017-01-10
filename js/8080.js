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
		CPU.registerPairs[0] = (CPU.registers[0] << 8) | CPU.registers[1];
	};
	CPU.Instructions[0x02] = function () {
		// STAX B
		var address = (CPU.registers[0] << 8) | CPU.registers[1];
		CPU.RAM[address] = CPU.registers[7];
	};
	CPU.Instructions[0x03] = function () {
		// INX B
		CPU.registerPairs[0]++;
		CPU.registers[0] = CPU.registerPairs[0] >> 8;
		CPU.registers[1] = CPU.registerPairs[0] & 0x0f;
		wait();
	};
	CPU.Instructions[0x04] = function () {
		// INR B
		CPU.registers[0]++;
		CPU.registerPairs[0] = (CPU.registers[0] << 8) | CPU.registers[1];
		setFlagZ(CPU.registers[0]);
		setFlagS(CPU.registers[0]);
		setFlagP(CPU.registers[0]);
		setFlagAC(CPU.registers[0]);
	};
	CPU.Instructions[0x05] = function () {
		// DCR B
		CPU.registers[0]--;
		CPU.registerPairs[0] = (CPU.registers[0] << 8) | CPU.registers[1];
		setFlagZ(CPU.registers[0]);
		setFlagS(CPU.registers[0]);
		setFlagP(CPU.registers[0]);
		setFlagAC(CPU.registers[0]);	
	};
}

function setFlagZ (result) {

}

function setFlagS (result) {

}

function setFlagP (result) {

}

function setFlagC (result) {

}

function setFlagAC (result) {

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