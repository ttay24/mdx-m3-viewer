import BinaryStream from "../../../common/binarystream";
import Modification from "./modification";

/**
 * A modified object.
 */
export default class ModifiedObject {
  oldId = "\0\0\0\0";
  newId = "\0\0\0\0";
  modifications: Modification[] = [];

  skipBytes?: number;
  skippyBuffer?: string;

  load(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    this.oldId = stream.readBinary(4);
    this.newId = stream.readBinary(4);

    console.log(`modified object: ${this.oldId} => ${this.newId}`);

    if (version >= 3) {
      this.skipBytes = stream.readUint32();
      console.log(`skipBytes: ${this.skipBytes}`);
      this.skippyBuffer = stream.readBinary(4 * this.skipBytes);
      console.log(`skippy data: ${this.skippyBuffer}`);
    }

    const numModifications = stream.readUint32();
    console.log(`numModifications: ${numModifications}`);

    for (let i = 0; i < numModifications; i++) {
      const modification = new Modification();

      modification.load(stream, useOptionalInts);

      this.modifications[i] = modification;
    }
  }

  save(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    if (this.oldId !== "\0\0\0\0") {
      stream.writeBinary(this.oldId);
    } else {
      stream.writeUint32(0);
    }

    if (this.newId !== "\0\0\0\0") {
      stream.writeBinary(this.newId);
    } else {
      stream.writeUint32(0);
    }

    if (version >= 3 && this.skipBytes && this.skippyBuffer) {
      stream.writeUint32(this.skipBytes);
      stream.writeBinary(this.skippyBuffer);
    }

    stream.writeUint32(this.modifications.length);

    for (const modification of this.modifications) {
      modification.save(stream, useOptionalInts);
    }
  }

  getByteLength(useOptionalInts: boolean): number {
    let size = 12;

    for (const modification of this.modifications) {
      size += modification.getByteLength(useOptionalInts);
    }

    return size;
  }
}
