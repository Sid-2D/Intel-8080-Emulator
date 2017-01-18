"use strict";

// According to Space Invaders specification
let displayWidth = 256, displayHeight = 224, aspectRatio; 

let gl;

function start () {
	let canvas = document.getElementById('Display');
	canvas.width = window.innerWidth * 0.75;
	aspectRatio = displayWidth / displayHeight;
	canvas.height = canvas.width * aspectRatio;
	initGL(canvas);
	initShaders();
	initBuffers();
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
}

function initGL (canvas) {
	gl = canvas.getContext("webgl");
	gl.viewportHeight = canvas.height;
	gl.viewportWidth = canvas.width;
}

function getShader (id) {

}

let shaderProgram;
function initShaders () {
	let fragmentShader = getShader("fragment");
	let vertexShader = getShader("vertex");
	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	gl.useProgram(shaderProgram);
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPositions");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "vertexColors");
	gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
}

// Vertex Position Attribute
let pixelPositionBuffer;
let pixelPositionItemSize = 2;
let pixelPositionNumberOfItems = 4 * displayHeight * displayWidth;

// Vertex Color Attribute
let pixelColorBuffer;
let pixelColorItemSize = 2;
let pixelColorNumberOfItems = 4 * displayHeight * displayWidth;

function initBuffers () {
	pixelPositionBuffer = gl.createBuffer();
	pixelColorBuffer = gl.createBuffer();
	let vertices = new Array();
	let pixelWidth = (1 / displayWidth) * 2;
	let pixelHeight = (1 / displayHeight) * 2;
	for (let i = 0; i < displayHeight; i++) {
		for (let j = 0; j < displayWidth; j++) {
			vertices = vertices.concat([
				-1 + pixelWidth + pixelWidth * j, 1 - 0.0 - pixelHeight * i,
				-1 + 0.0 + pixelWidth * j, 1 - 0.0 - pixelHeight * i,
				-1 + pixelWidth + pixelWidth * j, 1 - pixelHeight - pixelHeight * i,
				-1 + 0.0 + pixelWidth * j, 1 - pixelHeight - pixelHeight * i
			]);
		}
	}
	// Upload Vertex Data
	gl.bindBuffer(gl.ARRAY_BUFFER, pixelPositionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, pixelPositionItemSize, gl.FLOAT, false, 0, 0);
}

let displayBuffer = new Float32Array(displayWidth * displayHeight * 8);

// Matrix to decide if a pixel is on or off
let displayMatrix = new Uint8Array(256 * 224);

function turnPixelOn (position) {

}

function turnPixelOff (position) {

}

function setMatrix () {
	let matrixOffset, ramOffset;
	for (let i = 0; i < displayHeight; i++) {
		matrixOffset = i * displayWidth;
		ramOffset = i * 32;
		for (let j = 0; j < 32; j++) {
			matrixOffset += j + (j * 8);
			ramOffset += j;
			for (let k = 0; k < 8; k++) {
				if (CPU.RAM[0x2400 + ramOffset] & (1 << k)) {
					turnPixelOn(displayMatrix[matrixOffset + k]);
				} else {
					turnPixelOff(displayMatrix[matrixOffset + k]);
				}
			}
		}
	}
}

function drawScene () {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	setMatrix();
	// Upload Color Data
	gl.bindBuffer(gl.ARRAY_BUFFER, pixelColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, displayBuffer, gl.STATIC_DRAW);
	gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, pixelColorItemSize, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, pixelPositionNumberOfItems);
}