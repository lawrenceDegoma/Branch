// Element IDs shared by server and client comment components (a client module's exports can't be
// called from the server).

/** The post's comments toggle, which takes focus after a comment is deleted. */
export const commentsToggleId = (postId: string) => `comments-toggle-${postId}`;
export const panelId = (postId: string) => `comments-${postId}`;
