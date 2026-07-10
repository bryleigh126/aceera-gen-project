import {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder
} from "discord.js";
import fs from "fs";

// 🔥 HARD‑CODED TOKEN
const TOKEN = "YOUR_TOKEN_HERE";

// ⚙️ CONFIG — REPLACE THESE
const GEN_CHANNEL_ID = "YOUR_GEN_CHANNEL_ID";
const OWNER_ID = "YOUR_DISCORD_USER_ID"; // ONLY YOU CAN RESTOCK

// 📦 Load stock file
function loadStock() {
    if (!fs.existsSync("./stock.json")) return {};
    return JSON.parse(fs.readFileSync("./stock.json"));
}

function saveStock(data) {
    fs.writeFileSync("./stock.json", JSON.stringify(data, null, 4));
}

// ⏳ Cooldown map — 10 minutes
const cooldown = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

client.once("ready", () => {
    console.log(`🔥 Aceera Setup Gen online as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (msg.channel.id !== GEN_CHANNEL_ID) return;

    const args = msg.content.split(" ");

    // ---------------------------------------------------
    // 🔒 OWNER‑ONLY: ADD STOCK
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "addstock") {

        if (msg.author.id !== OWNER_ID) {
            return msg.reply("❌ Only the **owner** can restock.");
        }

        const type = args[2];
        if (!type) return msg.reply("❌ You must specify a **type**.");

        const rawLinks = msg.content.split(type)[1].trim();
        const links = rawLinks.split(",").map(l => l.trim()).filter(l => l.length > 0);

        if (links.length === 0) {
            return msg.reply("❌ No valid links found.");
        }

        let stock = loadStock();
        if (!stock[type]) stock[type] = [];

        stock[type].push(...links);
        saveStock(stock);

        return msg.reply(
            `✅ Added **${links.length}** items to \`${type}\`.\n📦 Total stock: **${stock[type].length}**`
        );
    }

    // ---------------------------------------------------
    // 📦 PUBLIC: STOCK OVERVIEW
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "stock") {
        const stock = loadStock();

        if (Object.keys(stock).length === 0) {
            return msg.reply("📭 There is **no stock** yet.");
        }

        let text = "📦 **Aceera Stock Overview**\n\n";

        for (const type of Object.keys(stock)) {
            text += `• \`${type}\`: **${stock[type].length}** item(s)\n`;
        }

        return msg.reply(text);
    }

    // ---------------------------------------------------
    // 🧩 PUBLIC: TYPES
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "types") {
        const stock = loadStock();

        if (Object.keys(stock).length === 0) {
            return msg.reply("📭 No stock types exist.");
        }

        let text = "🧩 **Available Types:**\n\n";
        for (const type of Object.keys(stock)) {
            text += `• ${type}\n`;
        }

        return msg.reply(text);
    }

    // ---------------------------------------------------
    // 📘 PUBLIC: HELP
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "help") {
        const embed = new EmbedBuilder()
            .setTitle("📘 Aceera Gen Help")
            .setDescription("Public commands:")
            .addFields(
                { name: "🔧 !gen <type>", value: "Generate one item." },
                { name: "📦 !gen stock", value: "Show all stock counts." },
                { name: "🧩 !gen types", value: "Show all stock types." },
                { name: "📘 !gen help", value: "Show this menu." }
            )
            .setColor("Orange");

        return msg.reply({ embeds: [embed] });
    }

    // ---------------------------------------------------
    // 🔒 OWNER: VIEW STOCK
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "viewstock") {
        if (msg.author.id !== OWNER_ID) return msg.reply("❌ Owner only.");

        const type = args[2];
        if (!type) return msg.reply("Usage: `!gen viewstock <type>`");

        const stock = loadStock();
        if (!stock[type] || stock[type].length === 0) {
            return msg.reply(`📭 \`${type}\` has **no stock**.`);
        }

        let text = `📦 **Stock for \`${type}\`:**\n\n`;
        stock[type].forEach((item, i) => {
            text += `${i + 1}. ${item}\n`;
        });

        return msg.reply(text);
    }

    // ---------------------------------------------------
    // 🔒 OWNER: REMOVE STOCK ITEM
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "removestock") {
        if (msg.author.id !== OWNER_ID) return msg.reply("❌ Owner only.");

        const type = args[2];
        const index = parseInt(args[3]) - 1;

        if (!type || isNaN(index)) {
            return msg.reply("Usage: `!gen removestock <type> <index>`");
        }

        let stock = loadStock();

        if (!stock[type] || !stock[type][index]) {
            return msg.reply("❌ Invalid type or index.");
        }

        const removed = stock[type].splice(index, 1)[0];
        saveStock(stock);

        return msg.reply(`🗑️ Removed: ${removed}`);
    }

    // ---------------------------------------------------
    // 🔒 OWNER: CLEAR STOCK
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1] === "clearstock") {
        if (msg.author.id !== OWNER_ID) return msg.reply("❌ Owner only.");

        const type = args[2];
        if (!type) return msg.reply("Usage: `!gen clearstock <type>`");

        let stock = loadStock();
        stock[type] = [];
        saveStock(stock);

        return msg.reply(`🧹 Cleared all stock for \`${type}\`.`);
    }

    // ---------------------------------------------------
    // 🎁 PUBLIC: GENERATE
    // ---------------------------------------------------
    if (args[0] === "!gen" && args[1]) {
        const type = args[1];

        // Cooldown check
        const now = Date.now();
        const last = cooldown.get(msg.author.id) || 0;

        if (now - last < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
            return msg.reply(`⏳ Cooldown active. Wait **${remaining} seconds**.`);
        }

        cooldown.set(msg.author.id, now);

        let stock = loadStock();

        if (!stock[type] || stock[type].length === 0) {
            return msg.reply(`📭 \`${type}\` is **out of stock**.`);
        }

        const item = stock[type].shift();
        saveStock(stock);

        try {
            await msg.author.send(`🎁 **Your Aceera (${type}):**\n${item}`);
        } catch {
            return msg.reply("❌ Enable DMs.");
        }

        const embed = new EmbedBuilder()
            .setTitle("🎁 Aceera Gen")
            .setDescription(`Your \`${type}\` item has been sent to your DMs.`)
            .setColor("Orange");

        return msg.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
