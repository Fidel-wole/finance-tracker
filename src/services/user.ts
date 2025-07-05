import { CreateUserInput } from "../interfaces/user";
import UserRepository from "../repositories/user";

export default class UserService {
  private userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(input: CreateUserInput) {
    return this.userRepository.createUser({
      data: input,
    });
  }

  async updateUser(id: string, input: Partial<CreateUserInput>) {
    return this.userRepository.updateUser({
      where: { id },
      data: input,
    });
  }

  async findByEmailOrPhone(email: string, phoneNumber: string) {
    return this.userRepository.findByEmailOrPhone(email, phoneNumber);
  }

  async getUserById(id: string) {
    return this.userRepository.getUserById(id);
  }

  async deleteUser(id: string) {
    return this.userRepository.deleteUser({
      where: { id }
    });
  }
}
