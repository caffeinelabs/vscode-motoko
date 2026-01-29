import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.resolve(__dirname, '../../logs.tmp');

export function logToFile(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;

    if (data !== undefined) {
        logMessage += '\n' + JSON.stringify(data, null, 2);
    }

    logMessage += '\n---\n';

    fs.appendFileSync(LOG_FILE, logMessage);
    console.warn(logMessage);
}

export function clearLogFile() {
    if (fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
    }
}
