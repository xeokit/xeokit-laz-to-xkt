/**
 * @desc Parses PCD point cloud data into an {@link XKTModel}.
 *
 * @param {Object} pcdData PCD file data.
 * @param {XKTModel} xktModel XKTModel to parse into.
 * @param {*} [options] Parsing options.
 */
function parsePCDIntoXKTModel(pcdData, xktModel, options = {}) {

    options.littleEndian = (options.littleEndian !== false);

    const textData = decodeText(new Uint8Array(pcdData));

    const header = parseHeader(textData);

    const positions = [];
    const normals = [];
    const colors = [];

    if (header.data === 'ascii') {

        const offset = header.offset;
        const pcdData = textData.substr(header.headerLen);
        const lines = pcdData.split('\n');

        for (let i = 0, l = lines.length; i < l; i++) {

            if (lines[i] === '') {
                continue;
            }

            const line = lines[i].split(' ');

            if (offset.x !== undefined) {
                positions.push(parseFloat(line[offset.x]));
                positions.push(parseFloat(line[offset.y]));
                positions.push(parseFloat(line[offset.z]));
            }

            if (offset.rgb !== undefined) {
                const rgb = parseFloat(line[offset.rgb]);
                const r = (rgb >> 16) & 0x0000ff;
                const g = (rgb >> 8) & 0x0000ff;
                const b = (rgb >> 0) & 0x0000ff;
                colors.push(r, g, b, 255);
            } else {
                colors.push(255);
                colors.push(255);
                colors.push(255);
                //      colors.push(255);
            }

            if (offset.normal_x !== undefined) {
                normals.push(parseFloat(line[offset.normal_x]));
                normals.push(parseFloat(line[offset.normal_y]));
                normals.push(parseFloat(line[offset.normal_z]));
            }
        }
    }

    if (header.data === 'binary_compressed') {

        const sizes = new Uint32Array(pcdData.slice(header.headerLen, header.headerLen + 8));
        const compressedSize = sizes[0];
        const decompressedSize = sizes[1];
        const decompressed = decompressLZF(new Uint8Array(pcdData, header.headerLen + 8, compressedSize), decompressedSize);
        const dataview = new DataView(decompressed.buffer);
        const offset = header.offset;

        for (let i = 0; i < header.points; i++) {

            if (offset.x !== undefined) {
                positions.push(dataview.getFloat32((header.points * offset.x) + header.size[0] * i, options.littleEndian));
                positions.push(dataview.getFloat32((header.points * offset.y) + header.size[1] * i, options.littleEndian));
                positions.push(dataview.getFloat32((header.points * offset.z) + header.size[2] * i, options.littleEndian));
            }

            if (offset.rgb !== undefined) {
                colors.push(dataview.getUint8((header.points * offset.rgb) + header.size[3] * i + 0));
                colors.push(dataview.getUint8((header.points * offset.rgb) + header.size[3] * i + 1));
                colors.push(dataview.getUint8((header.points * offset.rgb) + header.size[3] * i + 2));
                //    colors.push(255);
            } else {
                colors.push(1);
                colors.push(1);
                colors.push(1);
                //  colors.push(255);
            }

            if (offset.normal_x !== undefined) {
                normals.push(dataview.getFloat32((header.points * offset.normal_x) + header.size[4] * i, options.littleEndian));
                normals.push(dataview.getFloat32((header.points * offset.normal_y) + header.size[5] * i, options.littleEndian));
                normals.push(dataview.getFloat32((header.points * offset.normal_z) + header.size[6] * i, options.littleEndian));
            }
        }
    }

    if (header.data === 'binary') {

        const dataview = new DataView(pcdData, header.headerLen);
        const offset = header.offset;

        for (let i = 0, row = 0; i < header.points; i++, row += header.rowSize) {
            if (offset.x !== undefined) {
                positions.push(dataview.getFloat32(row + offset.x, options.littleEndian));
                positions.push(dataview.getFloat32(row + offset.y, options.littleEndian));
                positions.push(dataview.getFloat32(row + offset.z, options.littleEndian));
            }

            if (offset.rgb !== undefined) {
                colors.push(dataview.getUint8(row + offset.rgb + 2));
                colors.push(dataview.getUint8(row + offset.rgb + 1));
                colors.push(dataview.getUint8(row + offset.rgb + 0));
                //  colors.push(255);
            } else {
                colors.push(255);
                colors.push(255);
                colors.push(255);
                //  colors.push(255);
            }

            if (offset.normal_x !== undefined) {
                normals.push(dataview.getFloat32(row + offset.normal_x, options.littleEndian));
                normals.push(dataview.getFloat32(row + offset.normal_y, options.littleEndian));
                normals.push(dataview.getFloat32(row + offset.normal_z, options.littleEndian));
            }
        }
    }

    if (positions.length > 0) {

    }

    // if (normals.length > 0) {
    //
    // }

    if (colors.length > 0) {

    }

    xktModel.createGeometry({
        geometryId: "pointsGeometry",
        primitiveType: "points",
        positions: positions,
        colorsCompressed: colors && colors.length > 0 ? colors : null
    });

    xktModel.createMesh({
        meshId: "pointsMesh",
        geometryId: "pointsGeometry"
    });

    xktModel.createEntity({
        entityId: "geometries",
        meshIds: ["pointsMesh"]
    });
}

function parseHeader(data) {
    const header = {};
    const result1 = data.search(/[\r\n]DATA\s(\S*)\s/i);
    const result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.substr(result1 - 1));
    header.data = result2[1];
    header.headerLen = result2[0].length + result1;
    header.str = data.substr(0, header.headerLen);
    header.str = header.str.replace(/\#.*/gi, '');     // Strip comments
    header.version = /VERSION (.*)/i.exec(header.str); // Parse
    header.fields = /FIELDS (.*)/i.exec(header.str);
    header.size = /SIZE (.*)/i.exec(header.str);
    header.type = /TYPE (.*)/i.exec(header.str);
    header.count = /COUNT (.*)/i.exec(header.str);
    header.width = /WIDTH (.*)/i.exec(header.str);
    header.height = /HEIGHT (.*)/i.exec(header.str);
    header.viewpoint = /VIEWPOINT (.*)/i.exec(header.str);
    header.points = /POINTS (.*)/i.exec(header.str);
    if (header.version !== null) {
        header.version = parseFloat(header.version[1]);
    }
    if (header.fields !== null) {
        header.fields = header.fields[1].split(' ');
    }
    if (header.type !== null) {
        header.type = header.type[1].split(' ');
    }
    if (header.width !== null) {
        header.width = parseInt(header.width[1]);
    }
    if (header.height !== null) {
        header.height = parseInt(header.height[1]);
    }
    if (header.viewpoint !== null) {
        header.viewpoint = header.viewpoint[1];
    }
    if (header.points !== null) {
        header.points = parseInt(header.points[1], 10);
    }
    if (header.points === null) {
        header.points = header.width * header.height;
    }
    if (header.size !== null) {
        header.size = header.size[1].split(' ').map(function (x) {
            return parseInt(x, 10);
        });
    }
    if (header.count !== null) {
        header.count = header.count[1].split(' ').map(function (x) {
            return parseInt(x, 10);
        });
    } else {
        header.count = [];
        for (let i = 0, l = header.fields.length; i < l; i++) {
            header.count.push(1);
        }
    }
    header.offset = {};
    let sizeSum = 0;
    for (let i = 0, l = header.fields.length; i < l; i++) {
        if (header.data === 'ascii') {
            header.offset[header.fields[i]] = i;
        } else {
            header.offset[header.fields[i]] = sizeSum;
            sizeSum += header.size[i] * header.count[i];
        }
    }
    header.rowSize = sizeSum; // For binary only
    return header;
}

function decodeText(array) {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(array);
    }
    let s = '';
    for (let i = 0, il = array.length; i < il; i++) {
        s += String.fromCharCode(array[i]);
    }
    try {
        return decodeURIComponent(escape(s));
    } catch (e) {
        return s;
    }
}

function decompressLZF(inData, outLength) { // https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
    const inLength = inData.length;
    const outData = new Uint8Array(outLength);
    let inPtr = 0;
    let outPtr = 0;
    let ctrl;
    let len;
    let ref;
    do {
        ctrl = inData[inPtr++];
        if (ctrl < (1 << 5)) {
            ctrl++;
            if (outPtr + ctrl > outLength) throw new Error('Output buffer is not large enough');
            if (inPtr + ctrl > inLength) throw new Error('Invalid compressed data');
            do {
                outData[outPtr++] = inData[inPtr++];
            } while (--ctrl);
        } else {
            len = ctrl >> 5;
            ref = outPtr - ((ctrl & 0x1f) << 8) - 1;
            if (inPtr >= inLength) throw new Error('Invalid compressed data');
            if (len === 7) {
                len += inData[inPtr++];
                if (inPtr >= inLength) throw new Error('Invalid compressed data');
            }
            ref -= inData[inPtr++];
            if (outPtr + len + 2 > outLength) throw new Error('Output buffer is not large enough');
            if (ref < 0) throw new Error('Invalid compressed data');
            if (ref >= outPtr) throw new Error('Invalid compressed data');
            do {
                outData[outPtr++] = outData[ref++];
            } while (--len + 2);
        }
    } while (inPtr < inLength);
    return outData;
}

exports.parsePCDIntoXKTModel = parsePCDIntoXKTModel;