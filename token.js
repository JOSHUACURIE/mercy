import crypto from "crypto";

// Generate a 64-byte random secret in hex
const secret = crypto.randomBytes(64).toString("hex");

console.log("Your JWT Secret:");
console.log(secret);
