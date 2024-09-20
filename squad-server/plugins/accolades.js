import { DataTypes } from "sequelize";
import DiscordBasePlugin from "./discord-base-plugin";

export default class Accolades extends DiscordBasePlugin
{
	static get description() {
		return "This is a SquadJS plugin that awards points and other configurable awards to people in your discord for various meritorious acts in their games";
	}

	static get defaultEnabled() {
		return false;
	}

	static get optionsSpecification() {
		return {
			...DiscordBasePlugin.optionsSpecification,
			database: {
				required: true,
				connector: "mysql",
				description: "The mysql connector to store player data.",
				default: "mysql"
			},
			channelID: {
				required: true,
				description: "The ID of the channel to listen for messages on.",
				default: "",
				example: "667741905228136459"
			},
			habPoints: {
				required: true,
				description: "Number of points to award for destroying a HAB.",
				default: 3
			},
			radioPoints: {
				required: true,
				description: "Number of points to award for destroying a radio.",
				default: 5
			},
			killPoints: {
				required: true,
				description: "Number of points to award for killing a player.",
				default: 1
			},
			revivePoints: {
				required: true,
				description: "Number of points to award for reviving a team mate.",
				default: 1
			},
			teamKillPoints: {
				required: true,
				description: "Number of points to deduct for a team kill.",
				default: 2
			},
			newGamePoints: {
				required: true,
				description: "Number of points to award for playing a game.",
				default: 0
			},
			maxPoints: {
				required: true,
				description: "Max number of points a player can have.",
				default: 999999
			}
		};
	}

	constructor(...args) {
		super(...args);

		/* Class property initialization */
		this.models = {};
		this.points = {};

		/* Bind event scopes */
		this.onMessage = this.onMessage.bind(this);
		this.onNewGame = this.onNewGame.bind(this);
		this.onTeamKill = this.onTeamKill.bind(this);
		this.onPlayerDied = this.onPlayerDied.bind(this);
		this.onPlayerRevived = this.onPlayerRevived.bind(this);
		this.onPlayerConnected = this.onPlayerConnected.bind(this);
		this.onDeployableDamaged = this.onDeployableDamaged.bind(this);
	}

	async mount() {
		this.createModel("points", {
			id: {
				type: DataTypes.STRING,
				primaryKey: true
			},
			points: {
				type: DataTypes.INTEGER
			}
		}, {
			charset: "utf8mb4",
			collate: "utf8mb4_unicode_ci"
		});

		/* Discord event listeners */
		this.options.discordClient.on("message", this.onMessage);

		/* Game event listeners */
		this.server.on("NEW_GAME", this.onNewGame);
		this.server.on("TEAMKILL", this.onTeamKill);
		this.server.on("PLAYER_DIED", this.onPlayerDied);
		this.server.on("PLAYER_REVIVED", this.onPlayerRevived);
		this.server.on("PLAYER_CONNECTED", this.onPlayerConnected);
		this.server.on("DEPLOYABLE_DAMAGED", this.onDeployableDamaged);
	}

	async unmount() {
		/* Discord event listeners */
		this.options.discordClient.removeEventListener("message", this.onMessage);
	
		/* Game event listeners */
		this.server.removeEventListener("NEW_GAME", this.onNewGame);
		this.server.removeEventListener("TEAMKILL", this.onTeamKill);
		this.server.removeEventListener("PLAYER_DIED", this.onPlayerDied);
		this.server.removeEventListener("PLAYER_REVIVED", this.onPlayerRevived);
		this.server.removeEventListener("PLAYER_CONNECTED", this.onPlayerConnected);
		this.server.removeEventListener("DEPLOYABLE_DAMAGED", this.onDeployableDamaged);
	}

	// #region Event Handlers

	async onNewGame() {
		for (const [ id, points ] in Object.entries(this.points)) {
			const newPoints = points + this.options.newGamePoints;

			this.points[ id ] = Math.max(0, Math.min(newPoints, 999999));
		}
	}

	async onDeployableDamaged(info) {
		const { player, deployable, weapon } = info;

		if (!player || !deployable.match(/(?:FOBRadio|Hab)_/i) || !weapon.match(/_Deployable_/i)) {
			return;
		}

		const steamId = player.steamID;

		if (deployable.match(/(?:FOBRadio)/i)) {
			this.applyPoints(steamId, this.options.radioPoints);
		} else if (deployable.match(/(?:Hab)/i)) {
			this.applyPoints(steamId, this.options.habPoints);
		}
	}

	async onMessage(message) {
		// TODO: Handle discord messages
	}

	async onPlayerDied(info) {
		// TODO: Handle awarding points for player kills
	}

	async onTeamKill(info) {
		// TODO: Handle reducing points for a teamkill
	}

	async onPlayerConnected(info) {
		// TODO: Initialize player points if the player does not exist
	}

	async onPlayerRevived(info) {
		// TODO: Handle player revives
	}

	// #endregion

	createModel(name, schema) {
		this.models[ name ] = this.options.database.define(`Accolades_${ name }`, schema, {
			timestamps: false
		});
	}

	loadUserData() {

	}

	applyPoints(id, points) {
		const currentPoints = this.points[ id ];

		this.points[ id ] = Math.max(0, Math.min(currentPoints + points, this.options.maxPoints));
	}

	async savePoints() {
		for (const [ key, value ] of Object.entries(this.points)) {
			this.models.accolades
				.upsert({
					id: key,
					points: value
				});
		}
	}
}
