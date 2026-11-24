/**
 * Every site pop-up image is exactly this size (2:1), so the dialog can be laid
 * out before the image arrives and every pop-up looks the same. Shared by the
 * admin form, the `popup` upload type (which rejects anything else) and the
 * public dialog.
 */
export const POPUP_IMAGE_WIDTH = 1600
export const POPUP_IMAGE_HEIGHT = 800

/** "1600 × 800" — how the size is written in admin copy and errors. */
export const POPUP_IMAGE_SIZE_LABEL = `${POPUP_IMAGE_WIDTH} × ${POPUP_IMAGE_HEIGHT}`
