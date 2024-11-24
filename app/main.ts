import * as net from "net";

console.log("Logs from your program will appear here!");

const storage: { [key: string]: string } = {};

const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.on("data", (chunk: Buffer) => {
    const data = chunk.toString();

    const [command, key, value] = parseResponse(data);

    switch (command) {
      case "PING":
        connection.write("+PONG\r\n");
        break;
      case "ECHO":
        connection.write(`+${key}\r\n`);
        break;
      case "SET":
        storage[key] = value;
        connection.write("+OK\r\n");
        break;
      case "GET":
        if (storage[key] !== undefined) {
          connection.write(`+${storage[key]}\r\n`);
        } else {
          connection.write("$-1\r\n"); // RESP null bulk string
        }
        break;
      default:
        connection.write("-ERR unknown command\r\n");
        break;
    }

    // calling this without connection.end
  });
  // need to split the data
});

const parseResponse = (input: string): any => {
  const tokens = input.split("\r\n"); // Split input by RESP's line endings
  let index = 0;

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


server.listen(6379, "127.0.0.1");
