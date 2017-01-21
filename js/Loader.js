function loadInvaders () {
	var fileH = new XMLHttpRequest;
	fileH.open("GET", "ROM/Space Invaders/invaders.h", true);
	fileH.responseType = "arraybuffer";
	fileH.onload = function () {
		var program = new Uint8Array(fileH.response);
		for (var i = 0; i < program.length; i++) {
			CPU.RAM[i] = program[i];
		}
		fileG.send();
	};
	fileH.send();

	var fileG = new XMLHttpRequest;
	fileG.open("GET", "ROM/Space Invaders/invaders.g", true);
	fileG.responseType = "arraybuffer";
	fileG.onload = function () {
		var program = new Uint8Array(fileG.response);
		for (var i = 0; i < program.length; i++) {
			CPU.RAM[i + 0x800] = program[i];
		}
		fileF.send();
	};

	var fileF = new XMLHttpRequest;
	fileF.open("GET", "ROM/Space Invaders/invaders.f", true);
	fileF.responseType = "arraybuffer";
	fileF.onload = function () {
		var program = new Uint8Array(fileF.response);
		for (var i = 0; i < program.length; i++) {
			CPU.RAM[i + 0x1000] = program[i];
		}
		fileE.send();
	};

	var fileE = new XMLHttpRequest;
	fileE.open("GET", "ROM/Space Invaders/invaders.e", true);
	fileE.responseType = "arraybuffer";
	fileE.onload = function () {
		var program = new Uint8Array(fileE.response);
		for (var i = 0; i < program.length; i++) {
			CPU.RAM[i + 0x1800] = program[i];
		}
		runProgram();
	};
}