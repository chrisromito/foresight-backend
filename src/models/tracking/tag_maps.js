import { MappedTagTable } from '../tag'


/**
 * @const {MappedTagTable} PageViewPathTag
 */
export const PageViewPathTag = MappedTagTable('page_view_path_tag', 'page_view_path_id')


/**
 * @const {MappedTagTable} ActionTag - Maps tags to Actions
 */
export const ActionTag = MappedTagTable('action_tag', 'action_id')
