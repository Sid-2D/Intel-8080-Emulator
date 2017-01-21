"use strict";

// According to Space Invaders specification
var displayWidth = 256, displayHeight = 224, aspectRatio; 

var gl;

function initDisplay () {
	var canvas = document.getElementById('Display');
	canvas.width = window.innerWidth * 0.50;
	aspectRatio = displayHeight / displayWidth;
	canvas.height = canvas.width * aspectRatio;
	initGL(canvas);
	initShaders();
	initBuffers();
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	drawScene();
}

function initGL (canvas) {
	gl = canvas.getContext("webgl");
	gl.viewportHeight = canvas.height;
	gl.viewportWidth = canvas.width;
}

function getShader (id) {
	var shaderScript = document.getElementById(id);
	var script = shaderScript.textContent;
	var shader;
	if (shaderScript.type === "vertexShader") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	}
	gl.shaderSource(shader, script);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log(gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

var shaderProgram;
function initShaders () {
	var fragmentShader = getShader("fragment");
	var vertexShader = getShader("vertex");
	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	gl.useProgram(shaderProgram);
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPositions");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "vertexColor");
	gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
}

// Vertex Position Attribute
var pixelPositionBuffer;
var pixelPositionItemSize = 2;
var pixelPositionNumberOfItems = 4 * displayHeight * displayWidth;

// Vertex Color Attribute
var pixelColorBuffer;
var pixelColorItemSize = 1;
var pixelColorNumberOfItems = 4 * displayHeight * displayWidth;

function initBuffers () {
	pixelPositionBuffer = gl.createBuffer();
	pixelColorBuffer = gl.createBuffer();
	var vertices = new Float32Array(displayHeight * displayWidth * 8), len = 0;
	var pixelWidth = (1 / displayWidth) * 2;
	var pixelHeight = (1 / displayHeight) * 2;
	var pixelWidthXj, pixelHeightXi;
	for (var i = 0; i < 224; i++) {
		pixelHeightXi = pixelHeight * i;
		for (var j = 0; j < 256; j++) {
			pixelWidthXj = pixelWidth * j;
			vertices[len++] = -1 + pixelWidth + pixelWidthXj;
			vertices[len++] = 1 - pixelHeightXi;
			vertices[len++] = -1 + pixelWidthXj;
			vertices[len++] = 1 - pixelHeightXi;
			vertices[len++] = -1 + pixelWidth + pixelWidthXj;
			vertices[len++] = 1 - pixelHeight - pixelHeightXi;
			vertices[len++] = -1 + pixelWidthXj;
			vertices[len++] = 1 - pixelHeight - pixelHeightXi;
		}
	}
	// Upload Vertex Data
	gl.bindBuffer(gl.ARRAY_BUFFER, pixelPositionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, pixelPositionItemSize, gl.FLOAT, false, 0, 0);
}

var displayColorBuffer = new Float32Array(pixelColorNumberOfItems);

function turnPixelOn (position) {
	displayColorBuffer[position] = displayColorBuffer[position + 1] = displayColorBuffer[position + 2] = displayColorBuffer[position + 3] = 1;
}

function turnPixelOff (position) {
	displayColorBuffer[position] = displayColorBuffer[position + 1] = displayColorBuffer[position + 2] = displayColorBuffer[position + 3] = 0;
}

function setMatrix () {
	var matrixOffset, ramOffset;
	for (var i = 0; i < displayHeight; i++) {
		matrixOffset = i * displayWidth;
		ramOffset = i * 32;
		for (var j = 0; j < 32; j++) {
			for (var k = 0; k < 8; k++) {
				if (CPU.RAM[0x2400 + ramOffset] & (1 << k)) {
					turnPixelOn((matrixOffset + k)  * 4);
				} else {
					turnPixelOff((matrixOffset + k) * 4);
				}
			}
			matrixOffset += 8;
			ramOffset++;
		}
	}
}

function drawScene () {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	setMatrix();
	// Upload Color Data
	gl.bindBuffer(gl.ARRAY_BUFFER, pixelColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, displayColorBuffer, gl.STATIC_DRAW);
	gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, pixelColorItemSize, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, pixelPositionNumberOfItems);
}