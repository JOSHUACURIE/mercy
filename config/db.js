
const mongoose = require('mongoose');
const chalk = require('chalk');

const connectDB = async () => {
  try {
  
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(
      chalk.cyan.underline.bold(`✅ MongoDB Connected: ${conn.connection.host}`)
    );
  } catch (err) {
   
    console.error(chalk.red.bold(`❌ Error: ${err.message}`));

  
    process.exit(1);
  }
};

module.exports = connectDB;
