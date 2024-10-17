// Load environment variables from the .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { ChatOpenAI } = require("@langchain/openai");
const { 
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate 
} = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");

// Environment variables
const PORT = process.env.PORT || 3081;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-3.5-turbo';
const API_DAILY_LIMIT = parseInt(process.env.API_DAILY_LIMIT || '1000', 10);

const app = express();
app.use(express.json());
app.use(cors());

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    max: API_DAILY_LIMIT,
    message: `You have exceeded the request limit of ${API_DAILY_LIMIT} requests per 24 hours.`,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

const SYSTEM_MESSAGE = `You are an assistant to help create form.io forms with full and completed JSON files. You can add form fields which you believe would be relevant. The components you can use are: textfield, textarea, number, checkbox, radio, select, datetime, file, day, time, url, email, phoneNumber, currency, hidden, password, panel, well, button, columns, fieldset, htmlelement, content, html, alert, tabs`;

const chatModel = new ChatOpenAI({
    modelName: GPT_MODEL,
    temperature: 1,
    openAIApiKey: OPENAI_API_KEY,
});

function formJsonFromResponse(response) {
    const start = response.indexOf("{");
    const end = response.lastIndexOf("}") + 1;
    try {
        return JSON.parse(response.slice(start, end));
    } catch (error) {
        console.error("JSON parsing error: ", error);
        throw new Error("Invalid JSON response format.");
    }
}

app.post('/prompt', async (req, res) => {
    const question = req.body.prompt;

    try {
        if (!question) {
            return res.status(400).json({ error: "Missing prompt input." });
        }

        const chain = RunnableSequence.from([
            ChatPromptTemplate.fromMessages([
                SystemMessagePromptTemplate.fromTemplate(SYSTEM_MESSAGE),
                HumanMessagePromptTemplate.fromTemplate("{question}")
            ]),
            chatModel,
            new StringOutputParser(),
        ]);

        const answer = await chain.invoke({ question });
        res.json(formJsonFromResponse(answer));
    } catch (error) {
        console.error("Prompt processing error: ", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});