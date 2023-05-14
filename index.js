const TelegramBot = require('node-telegram-bot-api');

require("dotenv").config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

const Trello = require("trello");
const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_API_TOKEN);

const userMap = {}

const userStates = ["b", "l", "m"]

bot.onText(/\/start/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!userMap[chatId]) {
        bot.sendMessage(chatId, "Этот бот позволяет создать вам карточку на доске Trello платформы The Way.")
    }

    
    try {  
        userMap[chatId] = {"state" : "b"};

        const boards = await trello.makeRequest("GET", "/1/members/me/boards", {
            fields: "name"
        });

        const opts = {
            reply_markup: {
                inline_keyboard: []
            }
        };
        boards.forEach(element => {
            opts.reply_markup.inline_keyboard.push([
                {
                    text: element.name,
                    callback_data: "b:"+element.id
                }
            ])
        });

        bot.sendMessage(chatId, "Для начала выберите доску:", opts);   
    }
    catch (err) {
        console.log(err);
    }

});

bot.on('callback_query', async (query) => {
    const cbData = query.data.split(":");
    const chatId = query.from.id;

    if (userMap[chatId]) {
        if (cbData[0] === 'b') {
            const boardId = cbData[1];
    
            const boardLists = await trello.getListsOnBoard(boardId, "name");
            console.log(boardLists);
            const opts = {
                reply_markup: {
                  inline_keyboard: []
                }
            };
            
            boardLists.forEach(list => {
                opts.reply_markup.inline_keyboard.push([
                    {
                        text: list.name,
                        callback_data: "l:" + list.id
                    }
                ])
            })
                
            userMap[chatId]["boardId"] = cbData[1];
            userMap[chatId]["state"] = "l";
            
            bot.sendMessage(query.from.id, `Выберите колонку с выбранной доски`, opts);
        }

        if (cbData[0] === 'l') {
            const listId = cbData[1];
            userMap[chatId]["listId"] = listId;
            userMap[chatId]["state"] = "m";
            await bot.sendMessage(query.from.id, "Введите название и описание для новой карточки через новую строку\nПример:\nСогласовать бюджет\nКто нибудь согласуйте бюджет с @johndoe");
        }
    }
})


bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        if (msg.text === "/start") {
            return;
        }


        if (userMap[chatId]) {
            if (userMap[chatId]["state"] === "m") {
                const cardData = msg.text.split("\n");
                if (cardData.length != 2) {
                    bot.sendMessage(chatId, "Неправильный формат, введите название 'новая строка' описание карточки");
                } else {
                    const cardDescription = cardData.slice(1).join("\n");
                    await trello.makeRequest("postjson", "/1/cards", {
                        data: {
                            name: cardData[0],
                            desc: cardDescription
                        },
                        idList: userMap[chatId]["listId"]
                    })

                    bot.sendMessage(chatId, `Карточка была создана!\n Чтобы добавить еще введите /start`);
                }
            }
        }
    } catch (err) {
        console.log(err.response);
    }
});