const { RiotAPI, PlatformId } = require('@fightmegg/riot-api');
require('dotenv').config({ path: '.env.local' });

const accounts = [
    {
        name: "기생충",
        cluster: PlatformId.ASIA,
        region: PlatformId.KR,
        puuid: "VEcbCNiPy7douRm5n6kFlwlIN9NMST7uY72BK9d7qntuCYChASt_43jroc40pOnx-owxvXORXj5Tpg"
    },
    {
        name: "멍청한 렝가",
        cluster: PlatformId.ASIA,
        region: PlatformId.KR,
        puuid: "zeWug_LUBYyMExfpCX-CtmnlgCwuiZ2g-2xvnovRTVLKcKo049W04EY9gKk3ecZNWnooCUFoUiGKKA"
    }
]

const rAPI = new RiotAPI(process.env.RIOT_API_KEY);

let VERSION;
let LOCALE = rAPI.ddragon.locale;

rAPI.ddragon.versions.latest().then(version => VERSION = version).catch(console.error);

// Get game assets

function getIconUrl(championName) {
    return `https://ddragon.leagueoflegends.com/cdn/${VERSION}/img/champion/${championName}.png`;
}

async function getSpellUrl(spellId) {
    const summonerSpells = await rAPI.ddragon.summonerSpells({ locale: LOCALE, version: VERSION });
    const spellName = Object.values(summonerSpells.data).find(spell => spell.key == spellId).id;
    return `https://ddragon.leagueoflegends.com/cdn/${VERSION}/img/spell/${spellName}.png`;
}

function getItemUrl(itemId) {
    if(itemId == 0) return "https://www.deeplol.gg/images/icon_non_item.svg";
    return `https://ddragon.leagueoflegends.com/cdn/${VERSION}/img/item/${itemId}.png`;
}

async function getRuneUrls(runeIds) {
    let runes = await rAPI.ddragon.runesReforged({ locale: LOCALE, version: VERSION });
    runes = runes
        .flatMap(branch => branch.slots.flatMap(slot => slot.runes))
        .filter(rune => runeIds.includes(rune.id))
        .map(rune => `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`);
    return runes;
}

// Construct game objects

async function constructProfile(profileInfo) {
    const profile = {
        name: profileInfo.riotIdGameName,
        champion: profileInfo.championName,
        icon: await getIconUrl(profileInfo.championName),
        spell1: await getSpellUrl(profileInfo.summoner1Id),
        spell2: await getSpellUrl(profileInfo.summoner2Id),
        kills: profileInfo.kills,
        deaths: profileInfo.deaths,
        assists: profileInfo.assists,
        items: [
            getItemUrl(profileInfo.item0),
            getItemUrl(profileInfo.item1),
            getItemUrl(profileInfo.item2),
            getItemUrl(profileInfo.item3),
            getItemUrl(profileInfo.item4),
            getItemUrl(profileInfo.item5),
            getItemUrl(profileInfo.item6)
        ],
        runes: {
            primaryRunes: await getRuneUrls(profileInfo.perks.styles[0].selections.map(rune => rune.perk)),
            secondaryRunes: await getRuneUrls(profileInfo.perks.styles[1].selections.map(rune => rune.perk))
        }
    }
    return profile;
}

async function constructGame(gameInfo) {
    const game = {}
    game.profile = await constructProfile(gameInfo.info.participants.find(player => accounts.some(account => account.name === player.riotIdGameName)));
    game.enemyProfile = await constructProfile(gameInfo.info.participants.find(player => player.individualPosition === "JUNGLE" && accounts.every(account => account.name !== player.riotIdGameName)));
    return game;
}

async function tryAddGame(gameQuery, mongoClient) {
    try {
        const gameInfo = await rAPI.matchV5.getMatchById({
            cluster: accounts[0].cluster,
            matchId: gameQuery.matchId
        });
        const game = await constructGame(gameInfo);
        game.id = gameQuery.matchId;
        game.streamId = gameQuery.streamId;
        game.timestamp = gameQuery.timestamp;
        await addGame(game, mongoClient);
        return game;
    } catch(error) {
        console.error(error);
        return error;
    }
}

async function addGame(game, mongoClient) {
    await mongoClient.connect();
    const db = mongoClient.db('DekarsDojoDb');
    const games = db.collection('Games');
    await games.insertOne(game);
}

function updateGames() {
    // read all games from the database
    // alter games with new data
    // update games in the database
}

module.exports = { constructGame, tryAddGame };