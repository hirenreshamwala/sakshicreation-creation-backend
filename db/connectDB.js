let mongoose = require("mongoose");

let connectDB = () => {
    try {
        mongoose.connect(process.env.MONGO_URI)
          .then(() => {
            const port = process.env.PORT || 3000;
            console.log('Connected to Database Successfully');
          })
    } catch (error) {
        console.log('Database connection error:', error);
    }
}

module.exports =  {connectDB} ;