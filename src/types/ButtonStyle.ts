/** Visual styles for Discord buttons matching the public API values. */
export enum ButtonStyle {
	/** The most prominent option in a set of actions. */
	Primary = 1,
	/** A neutral action that complements the primary action. */
	Secondary = 2,
	/** Indicates a successful or positive action. */
	Success = 3,
	/** Highlights a potentially destructive action. */
	Danger = 4,
	/** Navigates the user to an external URL. */
	Link = 5,
	/** Initiates a premium purchase flow. */
	Premium = 6,
}

export default ButtonStyle;
