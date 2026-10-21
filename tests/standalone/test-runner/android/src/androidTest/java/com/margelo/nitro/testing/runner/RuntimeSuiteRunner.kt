package com.margelo.nitro.testing.runner

import org.junit.runner.notification.RunNotifier
import org.junit.runners.Parameterized
import org.junit.runners.model.Statement
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Runs native suites on four workers while keeping Android's instrumentation reporting ordered. */
class RuntimeSuiteRunner(
  testClass: Class<*>,
) : Parameterized(testClass) {
  override fun childrenInvoker(notifier: RunNotifier): Statement {
    val children = super.childrenInvoker(notifier)
    return object : Statement() {
      override fun evaluate() {
        val executor = Executors.newFixedThreadPool(4)
        try {
          HybridObjectTest.startSuites(executor, description.children.map { it.displayName }.toSet())
          children.evaluate()
        } finally {
          executor.shutdownNow()
          var interrupted = false
          while (!executor.isTerminated) {
            try {
              executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS)
            } catch (_: InterruptedException) {
              interrupted = true
            }
          }
          if (interrupted) Thread.currentThread().interrupt()
        }
      }
    }
  }
}
