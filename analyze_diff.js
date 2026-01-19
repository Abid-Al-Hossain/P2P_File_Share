const fs = require("fs");
const path = require("path");

const sentPath = "e:/01_P2P_File_Share/sent/2004088.pptx";
const receivedPath = "e:/01_P2P_File_Share/received/2004088.pptx";

try {
  const sent = fs.readFileSync(sentPath);
  const received = fs.readFileSync(receivedPath);

  console.log(`Sent size: ${sent.length}`);
  console.log(`Received size: ${received.length}`);
  console.log(`Diff: ${received.length - sent.length}`);

  // Check header
  console.log("Header match:", sent.slice(0, 20).equals(received.slice(0, 20)));

  // Check if received starts with sent (append scenario)
  // or if sent is inside received (prepend scenario)

  // Check for duplicate chunk at start
  const chunkSize = 16384;
  const chunk1 = received.slice(0, chunkSize);
  const chunk2 = received.slice(chunkSize, chunkSize * 2);

  if (chunk1.equals(chunk2)) {
    console.log("CRITICAL: First chunk is duplicated!");
  } else {
    console.log("First and second chunks are different.");
  }

  // Compare byte by byte to find first difference
  let firstDiff = -1;
  for (let i = 0; i < sent.length; i++) {
    if (sent[i] !== received[i]) {
      firstDiff = i;
      break;
    }
  }

  if (firstDiff === -1) {
    console.log("Sent content is identical to Received content prefix.");
    console.log("Extra data is at the end.");
  } else {
    console.log(`First difference at byte: ${firstDiff}`);
    console.log(
      `Sent[${firstDiff}]: ${sent[firstDiff]}, Received[${firstDiff}]: ${received[firstDiff]}`,
    );

    // Check if received has inserted data
    // Try to match sent[firstDiff] in received ahead
    const lookAhead = received.indexOf(sent[firstDiff], firstDiff);
    console.log(`Found sent byte at received offset: ${lookAhead}`);
  }
} catch (e) {
  console.error(e);
}
