import * as net from "net";

// TS version so much more concise

// RedisConfig
const args = {
  dir: '/tmp/redis-files',
  dbfilename: 'dump.rdb',
};

process.argv.forEach((arg, index) => {
  if (arg === '--dir' && process.argv[index + 1]) {
    args.dir = process.argv[index + 1];
  }
  if (arg === '--dbfilename' && process.argv[index + 1]) {
    args.dbfilename = process.argv[index + 1];
  }
});

type StorageEntry = { value: string; expiresAt: number | null };
// const storage: { [key: string]: string } = {};
const storage: { [key: string]: StorageEntry } = {};

const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.on("data", (chunk: Buffer) => {
    const data = chunk.toString();

    // redis-cli CONFIG GET dir
    const [command, key, value, expires, expiryTime] = parseResponse(data);

    switch (command) {
      case "PING":
        connection.write(simpleString("PONG"));
        break;
      case "ECHO":
        connection.write(simpleString(key));
        break;
      case "SET":
        storage[key] = {
          value: value,
          expiresAt: expires ? Date.now() + parseInt(expiryTime, 10) : null
        };

        console.log(`Expires at is: ${storage[key].expiresAt}`)

        connection.write("+OK\r\n");
        break;
      case "GET":
        if (storage[key] !== undefined) {
          if (storage[key].expiresAt !== null && Date.now() >= storage[key].expiresAt) {
            delete storage[key];
            connection.write("$-1\r\n"); // RESP null bulk string
          } else {
            connection.write(`+${storage[key].value}\r\n`);
          }
        } else {
          connection.write("$-1\r\n"); // RESP null bulk string
        }
        break;
      case "CONFIG":
        // CONFIG GET dir
        // return "dir", "/tmp/redis-data"
        connection.write(`*2\r\n$3\r\ndir\r\n$${args.dir.length}\r\n${args.dir}\r\n`);
        break;
      default:
        connection.write("-ERR unknown command\r\n");
        break;
    }
  });
});

// write a test for this
const parseResponse = (input: string): any => {
  const tokens = input.split("\r\n"); // Split input by RESP's line endings
  let index = 0;

  // this code here can be more readable as well
  const parse = (): any => {
    const token = tokens[index++];
    if (!token) return null;

    const type = token[0];

    switch (type) {
      case "*":
        const size = parseInt(token.slice(1));
        const array = [];

        for (let i = 0; i < size; i++) {
          array.push(parse());
        }
        return array;
      case "$":
        // this indicates next element is a string
        const length = parseInt(token.slice(1));
        if (length === -1) return null;
        // hence returning the next element
        return tokens[index++];
      default:
        throw new Error("Unknown type");
    }
  }

  return parse();
}

function simpleString(str: string): string {
  return `+${str}\r\n`;
}

function parseArgs(args: string[]): RedisConfig {

}

server.listen(6379, "127.0.0.1");
