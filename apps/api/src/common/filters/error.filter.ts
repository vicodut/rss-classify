import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  const statusCode = error.statusCode ?? 500;
  reply.code(statusCode).send({
    error: {
      message: statusCode === 500 ? "Internal server error" : error.message,
      code: error.code,
    },
  });
}
