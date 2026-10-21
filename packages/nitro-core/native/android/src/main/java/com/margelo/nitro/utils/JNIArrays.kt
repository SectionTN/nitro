package com.margelo.nitro.utils

/** Adapts generated JNI array elements without an intermediate List. */
inline fun <T, reified R> Array<T>.mapToArray(transform: (T) -> R): Array<R> = Array(size) { transform(this[it]) }

/** Adapts the primitive LongArray used to carry unsigned bits through JNI. */
inline fun <reified R> LongArray.mapToArray(transform: (Long) -> R): Array<R> = Array(size) { transform(this[it]) }

/** Adapts Kotlin values to JNI's primitive LongArray in one allocation. */
inline fun <T> Array<T>.mapToLongArray(transform: (T) -> Long): LongArray = LongArray(size) { transform(this[it]) }
