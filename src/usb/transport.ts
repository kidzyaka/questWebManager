export const ADB_FILTER = {
  classCode: 0xff,
  subclassCode: 0x42,
  protocolCode: 1,
};

export class UsbTransport {
  public device: USBDevice | null = null;
  private inEndpoint: number = 0;
  private outEndpoint: number = 0;

  async requestDevice(): Promise<USBDevice> {
    const device = await navigator.usb.requestDevice({ filters: [ADB_FILTER] });
    return device;
  }

  async connect(device: USBDevice): Promise<void> {
    this.device = device;
    
    if (!device.opened) {
      await device.open();
    }

    // ADB typically uses the first configuration
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find the ADB interface
    let adbInterface: USBInterface | undefined;
    let adbAlternate: USBAlternateInterface | undefined;

    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          if (
            alt.interfaceClass === ADB_FILTER.classCode &&
            alt.interfaceSubclass === ADB_FILTER.subclassCode &&
            alt.interfaceProtocol === ADB_FILTER.protocolCode
          ) {
            adbInterface = iface;
            adbAlternate = alt;
            break;
          }
        }
        if (adbInterface) break;
      }
      if (adbInterface) break;
    }

    if (!adbInterface || !adbAlternate) {
      throw new Error('ADB interface not found on device.');
    }

    // Claim the interface
    if (!adbInterface.claimed) {
      try {
        await device.claimInterface(adbInterface.interfaceNumber);
      } catch (e) {
        console.error('Failed to claim interface (device might be in use):', e);
        throw new Error('Could not claim USB interface. Ensure no other ADB server is running.');
      }
    }

    // Find endpoints
    for (const ep of adbAlternate.endpoints) {
      if (ep.direction === 'in' && ep.type === 'bulk') {
        this.inEndpoint = ep.endpointNumber;
      } else if (ep.direction === 'out' && ep.type === 'bulk') {
        this.outEndpoint = ep.endpointNumber;
      }
    }

    if (!this.inEndpoint || !this.outEndpoint) {
      throw new Error('Could not find bulk IN/OUT endpoints.');
    }
  }

  async read(length: number): Promise<DataView> {
    if (!this.device) throw new Error('Not connected');
    const result = await this.device.transferIn(this.inEndpoint, length);
    if (result.status !== 'ok') {
      throw new Error(`USB read failed with status: ${result.status}`);
    }
    return result.data!;
  }

  async write(data: BufferSource): Promise<void> {
    if (!this.device) throw new Error('Not connected');
    const result = await this.device.transferOut(this.outEndpoint, data);
    if (result.status !== 'ok') {
      throw new Error(`USB write failed with status: ${result.status}`);
    }
  }

  async close(): Promise<void> {
    if (this.device && this.device.opened) {
      await this.device.close();
    }
    this.device = null;
  }
}
