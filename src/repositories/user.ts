import { Prisma } from "../../generated/prisma";
import { db } from "../utils/db/db";

class UserRepository {
  private readonly db = db;

  createUser: Prisma.UserDelegate["create"] = (args) =>
    this.db.user.create(args);

  findUserById: Prisma.UserDelegate["findUnique"] = (args) =>
    this.db.user.findUnique(args);

  updateUser: Prisma.UserDelegate["update"] = (args) =>
    this.db.user.update(args);

  deleteUser: Prisma.UserDelegate["delete"] = (args) =>
    this.db.user.delete(args);

  // Additional methods for webhook processing
  async findByEmailOrPhone(email: string, phoneNumber: string) {
    return this.db.user.findFirst({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }
    });
  }

  async getUserById(id: string) {
    return this.db.user.findUnique({
      where: { id }
    });
  }
}

export default UserRepository;
