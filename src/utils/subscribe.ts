import type {UnsubscribeMethod} from '@/types';

/**
 * Adds a callback to the provided callback collection and returns a method
 * that removes the same callback from that collection.
 *
 * The returned unsubscribe method is safe to call multiple times.
 *
 * @param callback - Callback to subscribe.
 * @param set - Callback collection where the callback should be stored.
 * @returns Function that removes the callback from the collection.
 */
export default function subscribe<T>(
    callback: T,
    set: Set<T>
): UnsubscribeMethod {
    set.add(callback);

    return () => {
        set.delete(callback);
    };
}
