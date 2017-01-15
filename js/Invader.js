// This file will handle any I/O or related code that is exclusive to Space Invaders
"use strict";

// Function pointers for different I/O operations
var outPorts = new Array();
var inPorts = new Array();
for (var i = 0; i < 10; i++) {
	outPorts[i] = inPorts[i] = function () {
		// Empty
	};
}
//Globals for shift register value
var shiftOffset = 0, shiftRegisterLSB = 0, shiftRegisterMSB = 0;

// Define the functionality of output ports
outPorts[2] = function () {
	// 2nd port used for offset
	shiftOffset = CPU.registers[A] & 0x7;
};

outPorts[4] = function () {
	// 4th port used for register value
	shiftRegisterLSB = shiftRegisterMSB;
	shiftRegisterMSB = CPU.registers[A];
};

// Define the functionality of input ports
inPorts[3] = function () {
	CPU.registers[A] = ( ( (shiftRegisterMSB << 8) | shiftRegisterLSB ) >> (8 - shiftOffset) ) & 0xff;
};

function invaderIN (port) {
	inPorts[port]();
}

function invaderOUT (port) {
	outPorts[port]();
}